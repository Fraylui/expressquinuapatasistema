package com.expressvraem.modules.pasajes.service;

import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import com.expressvraem.modules.empresa.service.EmpresaConfigService;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import jakarta.persistence.EntityManager;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TicketPdfService {

    private final EntityManager em;
    private final EmpresaConfigService empresaConfigService;

    private static final float  PAGE_W   = 226.77f; // 80 mm
    private static final float  MARGIN   = 10f;
    private static final String BASE_URL = "expressvraem.pe/verificar/";

    public byte[] generarTicket(Pasaje p) {
        EmpresaConfig emp = empresaConfigService.get();
        String EMPRESA = emp.getNombre()    != null ? emp.getNombre()    : "Mi Empresa";
        String RUC     = emp.getRuc()       != null && !emp.getRuc().isEmpty() ? "RUC: " + emp.getRuc() : "";
        String DIR     = emp.getDireccion() != null ? emp.getDireccion() : "";
        String CIUDAD  = emp.getCiudad()    != null ? emp.getCiudad()    : "";
        try (PDDocument doc = new PDDocument()) {

            Object[] viajeRow = null;
            String origen = "", destino = "", placa = "", tipoVeh = "";
            try {
                viajeRow = (Object[]) em.createNativeQuery(
                    "SELECT v.id, v.fecha_hora_sal, vh.placa, vh.tipo, r.origen, r.destino " +
                    "FROM viajes v JOIN vehiculos vh ON vh.id=v.vehiculo_id " +
                    "JOIN rutas r ON r.id=v.ruta_id WHERE v.id=:vid")
                    .setParameter("vid", p.getViajeId()).getSingleResult();
                placa   = String.valueOf(viajeRow[2]);
                tipoVeh = String.valueOf(viajeRow[3]);
                origen  = String.valueOf(viajeRow[4]);
                destino = String.valueOf(viajeRow[5]);
            } catch (Exception ignored) {}

            String clienteNombres = "", clienteApellidos = "", clienteDni = "";
            String operadorNombre = "", agenciaNombre = "";
            try {
                Object[] cr = (Object[]) em.createNativeQuery(
                    "SELECT nombres, apellidos, num_doc FROM clientes WHERE id=:cid")
                    .setParameter("cid", p.getClienteId()).getSingleResult();
                clienteNombres   = String.valueOf(cr[0]);
                clienteApellidos = String.valueOf(cr[1]);
                clienteDni       = String.valueOf(cr[2]);
            } catch (Exception ignored) {}
            try {
                Object[] or2 = (Object[]) em.createNativeQuery(
                    "SELECT nombres || ' ' || apellidos FROM usuarios WHERE id=:uid")
                    .setParameter("uid", p.getVendedorId()).getSingleResult();
                operadorNombre = String.valueOf(or2[0]);
            } catch (Exception ignored) {}
            try {
                Object[] ar = (Object[]) em.createNativeQuery(
                    "SELECT nombre FROM agencias WHERE id=:aid")
                    .setParameter("aid", p.getAgenciaId()).getSingleResult();
                agenciaNombre = String.valueOf(ar[0]);
            } catch (Exception ignored) {}

            DateTimeFormatter dtfDate = DateTimeFormatter.ofPattern("dd/MM/yyyy");
            DateTimeFormatter dtfHora = DateTimeFormatter.ofPattern("hh:mm a");
            DateTimeFormatter dtfFull = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

            String fechaViaje = "", horaViaje = "";
            if (viajeRow != null && viajeRow[1] != null) {
                java.time.LocalDateTime ldt;
                if (viajeRow[1] instanceof java.time.OffsetDateTime odt)      ldt = odt.toLocalDateTime();
                else if (viajeRow[1] instanceof java.sql.Timestamp ts)        ldt = ts.toLocalDateTime();
                else                                                           ldt = null;
                if (ldt != null) {
                    fechaViaje = ldt.format(dtfDate);
                    horaViaje  = ldt.format(dtfHora);
                }
            }

            String cb      = p.getCodigoBoleta() != null ? p.getCodigoBoleta() : "VTA-" + p.getId();
            String qrUrl   = BASE_URL + cb;
            String emitido = p.getFechaVenta() != null ? p.getFechaVenta().format(dtfFull) : "";
            String serie   = p.getSerie()      != null ? p.getSerie()      : "T001";
            String correl  = p.getCorrelativo()!= null ? p.getCorrelativo() : String.format("%08d", p.getId());
            String hash    = computeHash(cb, p.getPrecioFinal().toPlainString(), clienteDni, emitido);

            float pageH = 610f;
            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                    y = ctext(cs, fontBold, 9f, EMPRESA, y);  y -= 2;
                y = ctext(cs, fontNorm, 7f, RUC,      y);  y -= 1;
                y = ctext(cs, fontNorm, 6f, DIR,      y);  y -= 1;
                y = ctext(cs, fontNorm, 6f, CIUDAD,   y);  y -= 3;
                y = dashes(cs, y); y -= 3;

                    y = ctext(cs, fontBold, 9f, "BOLETA DE VIAJE", y); y -= 2;
                y = ctext(cs, fontNorm, 7f, cb, y); y -= 3;

                    PDImageXObject qr = buildQr(doc, qrUrl);
                float qrSz = 80f;
                cs.drawImage(qr, (PAGE_W - qrSz) / 2f, y - qrSz, qrSz, qrSz);
                y -= (qrSz + 3);
                y = ctext(cs, fontNorm, 5.5f, "Escanea para verificar validez", y); y -= 2;

                y = dashes(cs, y); y -= 3;

                    y = lbl(cs, fontBold, fontNorm, 7f, "RUTA:",     ascii(origen) + " > " + ascii(destino), y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "FECHA:",    fechaViaje, y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "HORA SAL:", horaViaje, y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "VEHICULO:", ascii(tipoVeh) + " - " + ascii(placa), y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 8f, "ASIENTO N°:",
                        String.valueOf(p.getAsientoNumero() != null ? p.getAsientoNumero() : "?"), y);
                y -= 4;

                    y = dashes(cs, y); y -= 3;
                y = ctext(cs, fontBold, 7.5f, "DATOS DEL PASAJERO", y); y -= 3;
                y = lbl(cs, fontBold, fontNorm, 7f, "Pasajero:", ascii(clienteApellidos) + " " + ascii(clienteNombres), y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "DNI:", clienteDni, y); y -= 4;

                    y = dashes(cs, y); y -= 3;
                y = lbl(cs, fontBold, fontNorm, 8f, "PRECIO:", "S/ " + p.getPrecioBase().toPlainString(), y); y -= 1;
                if (p.getMontoDescuento() != null && p.getMontoDescuento().compareTo(java.math.BigDecimal.ZERO) > 0) {
                    y = lbl(cs, fontBold, fontNorm, 7f, "DESCUENTO:", "- S/ " + p.getMontoDescuento().toPlainString(), y); y -= 1;
                }
                y = lbl(cs, fontBold, fontNorm, 9f, "TOTAL:", "S/ " + p.getPrecioFinal().toPlainString(), y); y -= 1;
                y = lbl(cs, fontBold, fontNorm, 7f, "FORMA PAGO:", p.getFormaPago(), y); y -= 4;

                    y = dashes(cs, y); y -= 3;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Atendido por:", operadorNombre, y);  y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Agencia:", agenciaNombre, y);         y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Emitido:", emitido, y);               y -= 4;

                    y = dashes(cs, y); y -= 2;
                y = ctext(cs, fontBold, 7f, "[ CONTROL INTERNO ]", y); y -= 3;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Serie/Correl.:", serie + "-" + correl, y);  y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Estado:", p.getEstado(), y);                 y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Verificacion:", qrUrl, y);                   y -= 1;
                y = lbl(cs, fontBold, fontNorm, 6.5f, "Hash:",         hash, y);                    y -= 3;
                y = dashes(cs, y); y -= 3;

                    y = ctext(cs, fontBold, 8f, "Buen viaje!", y);                                    y -= 2;
                y = ctext(cs, fontNorm, 6.5f, "Conserve este voucher durante todo el trayecto", y); y -= 1;
                ctext(cs, fontNorm, 6.5f, EMPRESA, y);
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
        String s = ascii(t);
        float tw = font.getStringWidth(s) / 1000f * sz;
        cs.beginText(); cs.setFont(font, sz);
        cs.newLineAtOffset((PAGE_W - tw) / 2f, y - sz); cs.showText(s); cs.endText();
        return y - sz - 1;
    }

    private float lbl(PDPageContentStream cs, PDType1Font fB, PDType1Font fN,
                      float sz, String label, String val, float y) throws Exception {
        cs.beginText(); cs.setFont(fB, sz);
        cs.newLineAtOffset(MARGIN, y - sz); cs.showText(label + " "); cs.endText();
        float lw = fB.getStringWidth(label + " ") / 1000f * sz;
        String display = ascii(val);
        float maxW = PAGE_W - MARGIN - lw - MARGIN;
        if (fN.getStringWidth(display) / 1000f * sz > maxW && display.length() > 25)
            display = display.substring(0, 25) + "...";
        cs.beginText(); cs.setFont(fN, sz);
        cs.newLineAtOffset(MARGIN + lw, y - sz); cs.showText(display); cs.endText();
        return y - sz - 1;
    }

    private float dashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y); cs.lineTo(PAGE_W - MARGIN, y); cs.stroke();
        return y - 3;
    }

    private PDImageXObject buildQr(PDDocument doc, String text) throws Exception {
        QRCodeWriter w = new QRCodeWriter();
        Map<EncodeHintType, Object> h = new EnumMap<>(EncodeHintType.class);
        h.put(EncodeHintType.MARGIN, 1);
        BitMatrix m = w.encode(text, BarcodeFormat.QR_CODE, 200, 200, h);
        BufferedImage img = MatrixToImageWriter.toBufferedImage(m);
        return LosslessFactory.createFromImage(doc, img);
    }

    /** SHA-256 de los campos clave, primeros 8 caracteres hex en mayúsculas. */
    private String computeHash(String... parts) {
        try {
            String input = String.join("|", parts);
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02X", b & 0xFF));
            return sb.substring(0, 8);
        } catch (Exception e) { return "00000000"; }
    }

    private String ascii(String s) {
        if (s == null) return "";
        return s
            .replace('á','a').replace('à','a').replace('ä','a').replace('â','a')
            .replace('é','e').replace('è','e').replace('ë','e').replace('ê','e')
            .replace('í','i').replace('ì','i').replace('ï','i').replace('î','i')
            .replace('ó','o').replace('ò','o').replace('ö','o').replace('ô','o')
            .replace('ú','u').replace('ù','u').replace('ü','u').replace('û','u')
            .replace('ñ','n').replace('ç','c')
            .replace('Á','A').replace('À','A').replace('Ä','A').replace('Â','A')
            .replace('É','E').replace('È','E').replace('Ë','E').replace('Ê','E')
            .replace('Í','I').replace('Ì','I').replace('Ï','I').replace('Î','I')
            .replace('Ó','O').replace('Ò','O').replace('Ö','O').replace('Ô','O')
            .replace('Ú','U').replace('Ù','U').replace('Ü','U').replace('Û','U')
            .replace('Ñ','N').replace('Ç','C')
            .replace('→','>').replace('←','<').replace('—','-').replace('–','-')
            .replace('…','.').replace('"','"').replace('"','"')
            .replace('¡','!').replace('¿','?')
            .replaceAll("[^\\x00-\\x7E]", "?");
    }
}
