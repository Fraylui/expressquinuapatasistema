package com.expressvraem.modules.encomiendas.service;

import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import com.expressvraem.modules.empresa.service.EmpresaConfigService;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.shared.utils.PdfUtils;
import jakarta.persistence.EntityManager;
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
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class ComprobantePdfService {

    private final ClienteRepository clienteRepository;
    private final EntityManager entityManager;
    private final EmpresaConfigService empresaConfigService;

    @Value("${app.tracking.url:https://expressvraem.pe/tracking/}")
    private String trackUrl;

    private static final float PAGE_W = 226.77f; // 80 mm
    private static final float MARGIN = 10f;

    @Transactional(readOnly = true)
    public byte[] generarComprobante(Encomienda enc, String operadorNombre) {
        EmpresaConfig emp = empresaConfigService.get();
        String EMPRESA   = emp.getNombre()    != null ? emp.getNombre()    : "Mi Empresa";
        String RUC       = emp.getRuc()       != null && !emp.getRuc().isEmpty() ? "RUC: " + emp.getRuc() : "";
        String DIR       = emp.getDireccion() != null ? emp.getDireccion() : "";
        String CIUDAD    = emp.getCiudad()    != null ? emp.getCiudad()    : "";
        String LOGO_B64  = emp.getLogoBase64();

        try (PDDocument doc = new PDDocument()) {

            Cliente rem = clienteRepository.findById(enc.getRemitenteId()).orElse(null);
            Cliente des = clienteRepository.findById(enc.getDestinatarioId()).orElse(null);

            String remNombre = rem != null ? nombreDisplay(rem) : "—";
            String remDoc    = rem != null ? rem.getTipoDoc() + " " + rem.getNumDoc() : "";
            String remTel    = rem != null && rem.getTelefono() != null ? rem.getTelefono() : "";
            String desNombre = des != null ? nombreDisplay(des) : "—";
            String desTel    = des != null && des.getTelefono() != null ? des.getTelefono() : "";

            String agenciaDestNombre = "—";
            String agenciaDestCiudad = "";
            if (enc.getAgenciaDestinoId() != null) {
                try {
                    Object[] ag = (Object[]) entityManager
                        .createNativeQuery("SELECT nombre, ciudad FROM agencias WHERE id = :id")
                        .setParameter("id", enc.getAgenciaDestinoId()).getSingleResult();
                    agenciaDestNombre = ag[0] != null ? String.valueOf(ag[0]) : "—";
                    agenciaDestCiudad = ag[1] != null ? String.valueOf(ag[1]) : "";
                } catch (Exception ignored) {}
            }

            String viajeHora = "", viajePlaca = "", viajeRuta = "";
            if (enc.getViajeId() != null) {
                try {
                    Object[] vRow = (Object[]) entityManager.createNativeQuery(
                        "SELECT v.fecha_hora_sal, ve.placa, r.origen, r.destino " +
                        "FROM viajes v JOIN vehiculos ve ON ve.id=v.vehiculo_id " +
                        "JOIN rutas r ON r.id=v.ruta_id WHERE v.id=:id")
                        .setParameter("id", enc.getViajeId()).getSingleResult();
                    if (vRow[0] != null) {
                        DateTimeFormatter hFmt = DateTimeFormatter.ofPattern("HH:mm dd/MM");
                        if (vRow[0] instanceof java.sql.Timestamp ts)
                            viajeHora = ts.toLocalDateTime().format(hFmt);
                        else if (vRow[0] instanceof java.time.OffsetDateTime odt)
                            viajeHora = odt.format(hFmt);
                    }
                    viajePlaca = vRow[1] != null ? String.valueOf(vRow[1]) : "";
                    viajeRuta  = ascii(vRow[2] != null ? String.valueOf(vRow[2]) : "")
                               + " > " + ascii(vRow[3] != null ? String.valueOf(vRow[3]) : "");
                } catch (Exception ignored) {}
            }

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
            String fechaStr = enc.getFechaRegistro() != null ? enc.getFechaRegistro().format(dtf) : "—";

            boolean esPorCobrar = "POR_COBRAR".equals(enc.getFormaCobro());
            String qrContent    = trackUrl + enc.getCodigoTracking();

            // monto = precio base; precioEnvio = precio final (con descuento aplicado)
            BigDecimal montoBase  = enc.getMonto() != null ? enc.getMonto() : enc.getPrecioEnvio();
            BigDecimal descuento  = enc.getMontoDescuento() != null ? enc.getMontoDescuento() : BigDecimal.ZERO;
            BigDecimal montoFinal = enc.getPrecioEnvio() != null ? enc.getPrecioEnvio() : montoBase;
            boolean hayDescuento  = descuento.compareTo(BigDecimal.ZERO) > 0;
            String montoStr       = montoFinal != null ? "S/ " + montoFinal.toPlainString() : "—";

            String monto4hash   = enc.getMonto() != null
                    ? enc.getMonto().toPlainString()
                    : enc.getPrecioEnvio() != null ? enc.getPrecioEnvio().toPlainString() : "0";
            String hash = PdfUtils.sha256Short(enc.getCodigoTracking(), monto4hash, remDoc, fechaStr);

            // ── Estimar altura total ───────────────────────────────────────────
            // Sección CONTROL INTERNO (arriba): ~9 filas
            float ciH = 8 + 2              // header empresa compact
                      + 10 + 4            // tracking bold + gap
                      + 8 * 6             // 6 filas de datos
                      + 6;                // gap final
            float cortH = 0f;
            // Sección COMPROBANTE (abajo): cabecera + QR + datos
            float cpH = (LOGO_B64 != null && !LOGO_B64.isBlank() ? 38f : 0f) // logo
                      + 10 + 8 + 8 + 8    // header empresa
                      + 6                 // dash
                      + 12 + 14          // titulo + tracking
                      + 72 + 10          // QR + nota
                      + 6                // destino + dash
                      + 8 * 9            // rem + des + paquete
                      + (viajeHora.isEmpty() ? 0 : 8 * 3)
                      + (hayDescuento ? 8 * 4 : 0) // precio + descuento en ambas secciones
                      + 8 * 4            // cobro + emision
                      + 6                // dash
                      + 8 * 2            // footer
                      + MARGIN * 2;

            // Mínimo 330pt (~116mm) — suficiente para el contenido más compacto.
            // Spec comprobante: 150-180mm. El cálculo dinámico domina para contenido normal.
            float pageH = Math.max(ciH + cortH + cpH, 330f);
            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                // ════════════════════════════════════════════════════════════════
                //  SECCIÓN 1: CONTROL INTERNO  (copia del operador)
                // ════════════════════════════════════════════════════════════════

                // Cabecera compacta
                y = drawCenteredText(cs, fontBold, 7f, EMPRESA, y); y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, RUC, y);     y -= 3;

                y = drawDashes(cs, y); y -= 2;

                y = drawCenteredText(cs, fontBold, 7.5f, "CONTROL INTERNO", y); y -= 2;

                // Tracking en grande
                y = drawCenteredText(cs, fontBold, 10f, enc.getCodigoTracking(), y); y -= 4;

                // Serie/correlativo
                if (enc.getSerie() != null && enc.getCorrelativo() != null) {
                    y = drawCenteredText(cs, fontNorm, 6.5f, enc.getSerie() + " - " + enc.getCorrelativo(), y); y -= 3;
                }

                // Datos de control
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Fecha:",       fechaStr, y);               y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Operador:",    operadorNombre, y);          y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Estado:",      enc.getEstado(), y);         y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Remitente:",   remNombre, y);               y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Doc rem.:",    remDoc, y);                  y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Destinatario:", desNombre, y);              y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Destino:",     agenciaDestNombre + (agenciaDestCiudad.isEmpty() ? "" : " - " + agenciaDestCiudad), y); y -= 1;
                if (!viajeHora.isEmpty()) {
                    y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Viaje:",   viajeRuta + "  " + viajeHora + "  " + viajePlaca, y); y -= 1;
                }
                if (hayDescuento) {
                    y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Precio:",    "S/ " + montoBase.toPlainString(), y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Descuento:", "- S/ " + descuento.toPlainString(), y); y -= 1;
                }
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Monto:",       montoStr + (esPorCobrar ? " (EN DESTINO)" : ""), y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Forma pago:",  esPorCobrar ? "POR COBRAR" : (enc.getFormaCobro() != null ? enc.getFormaCobro() : "EFECTIVO"), y); y -= 2;
                y = drawLabel(cs, fontBold, fontNorm, 6f,   "Hash ctrl:",   hash, y); y -= 4;

                // ════════════════════════════════════════════════════════════════
                //  SECCIÓN 2: COMPROBANTE DE ENCOMIENDA (copia del cliente)
                // ════════════════════════════════════════════════════════════════

                // Encabezado completo
                PDImageXObject logoImg = buildLogoImage(doc, LOGO_B64);
                if (logoImg != null) {
                    float maxLogoH = 34f;
                    float ratio    = (float) logoImg.getWidth() / logoImg.getHeight();
                    float logoW    = Math.min(maxLogoH * ratio, PAGE_W - MARGIN * 2);
                    float logoH    = logoW / ratio;
                    cs.drawImage(logoImg, (PAGE_W - logoW) / 2f, y - logoH, logoW, logoH);
                    y -= (logoH + 4);
                }
                y = drawCenteredText(cs, fontBold, 9f, EMPRESA, y);  y -= 2;
                y = drawCenteredText(cs, fontNorm, 7f, RUC, y);      y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, DIR, y);      y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, CIUDAD, y);   y -= 4;
                y = drawDashes(cs, y);                                y -= 3;

                // Título + tracking
                y = drawCenteredText(cs, fontBold, 8f, "COMPROBANTE DE ENCOMIENDA", y); y -= 2;
                y = drawCenteredText(cs, fontBold, 11f, enc.getCodigoTracking(), y);    y -= 4;

                // QR
                PDImageXObject qrImg = buildQrImage(doc, qrContent);
                float qrSize = 72f;
                cs.drawImage(qrImg, (PAGE_W - qrSize) / 2f, y - qrSize, qrSize, qrSize);
                y -= (qrSize + 3);
                y = drawCenteredText(cs, fontNorm, 5.5f, "Escanea para rastrear tu encomienda", y); y -= 2;

                // Destino
                y = drawCenteredText(cs, fontBold, 8f, "DESTINO: " + agenciaDestCiudad.toUpperCase(), y);
                y -= 3;
                y = drawDashes(cs, y); y -= 3;

                // Remitente
                y = drawLabel(cs, fontBold, fontNorm, 7f, "REMITENTE:", remNombre, y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Documento:", remDoc, y);
                if (!remTel.isEmpty()) { y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. rem.:", remTel, y); }
                y -= 3;

                // Destinatario
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DESTINATARIO:", desNombre, y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Agencia dest.:", agenciaDestNombre, y);
                if (!desTel.isEmpty()) { y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. dest.:", desTel, y); }
                y -= 3;

                // Paquete
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Contenido:", enc.getDescripcion(), y);
                if (enc.getPesoKg() != null) { y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Peso:", enc.getPesoKg() + " kg", y); }
                int bultos = enc.getNumBultos() != null ? enc.getNumBultos() : 1;
                y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Bultos:", String.valueOf(bultos), y);
                y -= 3;

                // Viaje asignado
                if (!viajeHora.isEmpty()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Viaje:", viajeRuta, y);       y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Hora salida:", viajeHora, y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Vehiculo:", viajePlaca, y);   y -= 3;
                }

                // Cobro
                if (hayDescuento) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Precio:",    "S/ " + montoBase.toPlainString(), y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Descuento:", "- S/ " + descuento.toPlainString(), y); y -= 1;
                }
                if (esPorCobrar) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr + " (EN DESTINO)", y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Cobro:", "POR COBRAR AL DESTINATARIO", y);
                } else {
                    String cobro = enc.getFormaCobro() != null ? enc.getFormaCobro() : "EFECTIVO";
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr, y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Forma pago:", cobro, y);
                }
                y -= 3;

                // Emisión
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Fecha:", fechaStr, y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Operador:", operadorNombre, y); y -= 3;

                y = drawDashes(cs, y); y -= 3;

                // Footer cliente
                y = drawCenteredText(cs, fontObliq, 6.5f, "Conserve este comprobante.", y); y -= 1;
                drawCenteredText(cs, fontNorm, 6f, "Estado: " + enc.getEstado(), y);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generando comprobante PDF: " + e.getMessage(), e);
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private String nombreDisplay(Cliente c) {
        if ("EMPRESA".equals(c.getTipo()) && c.getRazonSocial() != null) return c.getRazonSocial();
        return c.getApellidos() + ", " + c.getNombres();
    }

    private float drawCenteredText(PDPageContentStream cs, PDType1Font font, float size,
                                   String text, float y) throws Exception {
        String safe = ascii(text);
        float tw = font.getStringWidth(safe) / 1000f * size;
        cs.beginText(); cs.setFont(font, size);
        cs.newLineAtOffset((PAGE_W - tw) / 2f, y - size); cs.showText(safe); cs.endText();
        return y - size - 1;
    }

    private float drawLabel(PDPageContentStream cs, PDType1Font fontB, PDType1Font fontN,
                            float size, String label, String value, float y) throws Exception {
        String safeLabel = ascii(label) + " ";
        cs.beginText(); cs.setFont(fontB, size);
        cs.newLineAtOffset(MARGIN, y - size); cs.showText(safeLabel); cs.endText();
        float labelW = fontB.getStringWidth(safeLabel) / 1000f * size;
        float maxW   = PAGE_W - MARGIN - (MARGIN + labelW);
        String display = ascii(value != null ? value : "-");
        if (fontN.getStringWidth(display) / 1000f * size > maxW && display.length() > 22)
            display = display.substring(0, Math.min(display.length(), 28)) + "...";
        cs.beginText(); cs.setFont(fontN, size);
        cs.newLineAtOffset(MARGIN + labelW, y - size); cs.showText(display); cs.endText();
        return y - size - 1;
    }

    private float drawDashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y); cs.lineTo(PAGE_W - MARGIN, y); cs.stroke();
        return y - 3;
    }

    // Métodos delegados a PdfUtils (eliminación de código duplicado — DRY)
    private PDImageXObject buildLogoImage(PDDocument doc, String b64) {
        return PdfUtils.buildLogoImage(doc, b64);
    }

    private PDImageXObject buildQrImage(PDDocument doc, String text) throws Exception {
        return PdfUtils.buildQrImage(doc, text, 200);
    }

    private String ascii(String s) {
        return PdfUtils.ascii(s);
    }
}
