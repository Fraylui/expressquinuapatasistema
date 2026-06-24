package com.expressvraem.modules.pasajes.service;

import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import com.expressvraem.modules.empresa.service.EmpresaConfigService;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.shared.utils.PdfUtils;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.persistence.EntityManager;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * Genera el ticket de pasaje en formato 80 mm de ancho, altura variable (~120-155 mm)
 * para impresora térmica Epson TM-T20 / Xprinter XP-58.
 *
 * PAGE_W = 226.77 pt = 80 mm (1 mm = 2.8346 pt).
 * La altura se calcula dinámicamente según el contenido real.
 */
@Service
@RequiredArgsConstructor
public class TicketPdfService {

    private final EntityManager em;
    private final EmpresaConfigService empresaConfigService;

    @Value("${app.verificacion.url:https://expressvraem.pe/verificar/}")
    private String verificacionUrl;

    // Dimensiones 80 mm de ancho, sin alto fijo — se calcula por contenido
    private static final float PAGE_W = 226.77f;
    private static final float MARGIN = 10f;
    private static final float QR_SZ  = 76f;   // 26.8 mm — legible en térmica

    public byte[] generarTicket(Pasaje p) {
        EmpresaConfig emp = empresaConfigService.get();
        String empresa  = emp.getNombre()    != null ? emp.getNombre()    : "Mi Empresa";
        String ruc      = emp.getRuc()       != null && !emp.getRuc().isEmpty() ? "RUC: " + emp.getRuc() : "";
        String dir      = emp.getDireccion() != null ? emp.getDireccion() : "";
        String ciudad   = emp.getCiudad()    != null ? emp.getCiudad()    : "";
        String logoB64  = emp.getLogoBase64();

        try (PDDocument doc = new PDDocument()) {

            // ── Enriquecimiento de datos ──────────────────────────────────────
            Object[] viajeRow = null;
            String origen = "", destino = "", placa = "", tipoVeh = "";
            try {
                viajeRow = (Object[]) em.createNativeQuery(
                    "SELECT v.id, v.fecha_hora_sal, vh.placa, vh.tipo, r.origen, r.destino " +
                    "FROM viajes v JOIN vehiculos vh ON vh.id=v.vehiculo_id " +
                    "JOIN rutas r ON r.id=v.ruta_id WHERE v.id=:vid")
                    .setParameter("vid", p.getViajeId()).getSingleResult();
                placa   = PdfUtils.ascii(String.valueOf(viajeRow[2]));
                tipoVeh = PdfUtils.ascii(String.valueOf(viajeRow[3]));
                origen  = PdfUtils.ascii(String.valueOf(viajeRow[4]));
                destino = PdfUtils.ascii(String.valueOf(viajeRow[5]));
            } catch (Exception ignored) {}

            String clienteNombres = "", clienteApellidos = "", clienteDni = "";
            String operadorNombre = "", agenciaNombre = "";
            try {
                Object[] cr = (Object[]) em.createNativeQuery(
                    "SELECT nombres, apellidos, num_doc FROM clientes WHERE id=:cid")
                    .setParameter("cid", p.getClienteId()).getSingleResult();
                clienteNombres   = PdfUtils.ascii(String.valueOf(cr[0]));
                clienteApellidos = PdfUtils.ascii(String.valueOf(cr[1]));
                clienteDni       = String.valueOf(cr[2]);
            } catch (Exception ignored) {}
            // Consultas de una sola columna: Hibernate devuelve el escalar, no Object[]
            try {
                Object or2 = em.createNativeQuery(
                    "SELECT nombres || ' ' || apellidos FROM usuarios WHERE id=:uid")
                    .setParameter("uid", p.getVendedorId()).getSingleResult();
                operadorNombre = PdfUtils.ascii(String.valueOf(or2));
            } catch (Exception ignored) {}
            try {
                Object ar = em.createNativeQuery(
                    "SELECT nombre FROM agencias WHERE id=:aid")
                    .setParameter("aid", p.getAgenciaId()).getSingleResult();
                agenciaNombre = PdfUtils.ascii(String.valueOf(ar));
            } catch (Exception ignored) {}

            DateTimeFormatter dtfDate = DateTimeFormatter.ofPattern("dd/MM/yyyy");
            DateTimeFormatter dtfHora = DateTimeFormatter.ofPattern("hh:mm a");
            DateTimeFormatter dtfFull = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

            String fechaViaje = "", horaViaje = "";
            if (viajeRow != null && viajeRow[1] != null) {
                java.time.LocalDateTime ldt;
                if (viajeRow[1] instanceof java.time.OffsetDateTime odt) ldt = odt.toLocalDateTime();
                else if (viajeRow[1] instanceof java.sql.Timestamp ts)   ldt = ts.toLocalDateTime();
                else if (viajeRow[1] instanceof java.time.Instant ins)
                    ldt = java.time.LocalDateTime.ofInstant(ins, java.time.ZoneId.of("America/Lima"));
                else                                                        ldt = null;
                if (ldt != null) {
                    fechaViaje = ldt.format(dtfDate);
                    horaViaje  = ldt.format(dtfHora);
                }
            }

            String cb      = p.getCodigoBoleta() != null ? p.getCodigoBoleta() : "VTA-" + p.getId();
            String qrUrl   = verificacionUrl + cb;
            String emitido = p.getFechaVenta() != null ? p.getFechaVenta().format(dtfFull) : "";
            String serie   = p.getSerie()      != null ? p.getSerie()      : "T001";
            String correl  = p.getCorrelativo()!= null ? p.getCorrelativo() : String.format("%08d", p.getId());
            String hash    = PdfUtils.sha256Short(cb, p.getPrecioFinal().toPlainString(), clienteDni, emitido);

            boolean hasLogo     = logoB64 != null && !logoB64.isBlank();
            boolean hasDiscount = p.getMontoDescuento() != null
                               && p.getMontoDescuento().compareTo(BigDecimal.ZERO) > 0;

            // ── Altura dinámica según contenido real (~120-155 mm) ────────────
            // Base calculada midiendo cada bloque de dibujo:
            //   header(45) + boleta-title(23) + QR(QR_SZ+11.5) + trip(55) +
            //   pasajero(38.5) + precio(39) + agencia(34.5) + ctrl(58) + footer(27)
            // + márgenes top+bottom (2×MARGIN)
            float baseH = 45f + 23f + QR_SZ + 11.5f + 55f + 38.5f + 39f + 34.5f + 58f + 27f
                        + (MARGIN * 2);
            float pageH = baseH
                        + (hasLogo ? 40f : 0f)
                        + (hasDiscount ? 10f : 0f);

            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                // Logo
                PDImageXObject logoImg = PdfUtils.buildLogoImage(doc, logoB64);
                if (logoImg != null) {
                    float maxLogoH = 34f;
                    float ratio    = (float) logoImg.getWidth() / logoImg.getHeight();
                    float logoW    = Math.min(maxLogoH * ratio, PAGE_W - MARGIN * 2);
                    float logoH    = logoW / ratio;
                    cs.drawImage(logoImg, (PAGE_W - logoW) / 2f, y - logoH, logoW, logoH);
                    y -= (logoH + 4);
                }

                // Encabezado empresa
                y = ctext(cs, fontBold, 9f, empresa, y);  y -= 2;
                y = ctext(cs, fontNorm, 7f, ruc,      y);  y -= 1;
                y = ctext(cs, fontNorm, 6f, dir,      y);  y -= 1;
                y = ctext(cs, fontNorm, 6f, ciudad,   y);  y -= 3;
                y = dashes(cs, y);                          y -= 3;

                // Título boleta
                y = ctext(cs, fontBold, 9f, "BOLETA DE VIAJE", y); y -= 2;
                y = ctext(cs, fontNorm, 7f, cb, y);                 y -= 3;

                // QR
                PDImageXObject qr = PdfUtils.buildQrImage(doc, qrUrl, 200);
                cs.drawImage(qr, (PAGE_W - QR_SZ) / 2f, y - QR_SZ, QR_SZ, QR_SZ);
                y -= (QR_SZ + 3);
                y = ctext(cs, fontNorm, 5.5f, "Escanea para verificar validez", y); y -= 2;
                y = dashes(cs, y); y -= 3;

                // Datos del viaje
                y = lbl(cs, fontBold, fontNorm, 7f, "RUTA:",     origen + " > " + destino, y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "FECHA:",    fechaViaje, y);                y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "HORA SAL:", horaViaje, y);                 y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "VEHICULO:", tipoVeh + " - " + placa, y);  y -= 1;
                y = lbl(cs, fontBold, fontNorm, 8f, "ASIENTO Nro:",
                        String.valueOf(p.getAsientoNumero() != null ? p.getAsientoNumero() : "?"), y);
                y -= 4;

                // Datos pasajero
                y = dashes(cs, y); y -= 3;
                y = ctext(cs, fontBold, 7.5f, "DATOS DEL PASAJERO", y); y -= 3;
                y = lbl(cs, fontBold, fontNorm, 7f, "Pasajero:",
                        PdfUtils.truncate(clienteApellidos + " " + clienteNombres, 28), y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "DNI:", clienteDni, y); y -= 4;

                // Precio
                y = dashes(cs, y); y -= 3;
                y = lbl(cs, fontBold, fontNorm, 8f, "PRECIO:", "S/ " + p.getPrecioBase().toPlainString(), y); y -= 1;
                if (hasDiscount) {
                    y = lbl(cs, fontBold, fontNorm, 7f, "DESCUENTO:",
                            "- S/ " + p.getMontoDescuento().toPlainString(), y); y -= 1;
                }
                y = lbl(cs, fontBold, fontNorm, 9f, "TOTAL:", "S/ " + p.getPrecioFinal().toPlainString(), y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "FORMA PAGO:", p.getFormaPago(), y); y -= 4;

                // Agencia / operador
                y = dashes(cs, y); y -= 3;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Atendido por:", operadorNombre, y);  y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Agencia:", agenciaNombre, y);         y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Emitido:", emitido, y);               y -= 4;

                // Control interno
                y = dashes(cs, y); y -= 2;
                y = ctext(cs, fontBold, 7f, "[ CONTROL INTERNO ]", y); y -= 3;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Serie/Correl.:", serie + "-" + correl, y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Estado:", p.getEstado(), y);                y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Verificacion:", qrUrl, y);                  y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Hash:", hash, y);                           y -= 3;
                y = dashes(cs, y); y -= 3;

                // Footer
                y = ctext(cs, fontBold, 8f, "Buen viaje!", y); y -= 2;
                y = ctext(cs, fontNorm, 6.5f, "Conserve este voucher durante todo el trayecto", y); y -= 1;
                ctext(cs, fontNorm, 6.5f, empresa, y);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generando ticket: " + e.getMessage(), e);
        }
    }

    // ── Draw helpers ──────────────────────────────────────────────────────────

    private float ctext(PDPageContentStream cs, PDType1Font font, float sz, String t, float y) throws Exception {
        String s = PdfUtils.ascii(t);
        float tw = font.getStringWidth(s) / 1000f * sz;
        cs.beginText(); cs.setFont(font, sz);
        cs.newLineAtOffset((PAGE_W - tw) / 2f, y - sz); cs.showText(s); cs.endText();
        return y - sz - 1;
    }

    private float lbl(PDPageContentStream cs, PDType1Font fB, PDType1Font fN,
                      float sz, String label, String val, float y) throws Exception {
        String safeLabel = PdfUtils.ascii(label) + " ";
        cs.beginText(); cs.setFont(fB, sz);
        cs.newLineAtOffset(MARGIN, y - sz); cs.showText(safeLabel); cs.endText();
        float lw = fB.getStringWidth(safeLabel) / 1000f * sz;
        String display = PdfUtils.ascii(val);
        float maxW = PAGE_W - MARGIN - lw - MARGIN;
        if (fN.getStringWidth(display) / 1000f * sz > maxW)
            display = PdfUtils.truncate(display, 28);
        cs.beginText(); cs.setFont(fN, sz);
        cs.newLineAtOffset(MARGIN + lw, y - sz); cs.showText(display); cs.endText();
        return y - sz - 1;
    }

    private float dashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y); cs.lineTo(PAGE_W - MARGIN, y); cs.stroke();
        return y - 3;
    }
}
