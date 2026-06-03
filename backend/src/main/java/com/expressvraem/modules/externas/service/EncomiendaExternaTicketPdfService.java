package com.expressvraem.modules.externas.service;

import com.expressvraem.modules.externas.entity.EncomiendaExterna;
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

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EncomiendaExternaTicketPdfService {

    private static final float  PAGE_W   = 226.77f; // 80 mm
    private static final float  MARGIN   = 10f;
    private static final String EMPRESA  = "EXPRESS QUINUAPATA VRAEM S.A.C.";
    private static final String RUC      = "RUC: 20601234567";
    private static final String DIR      = "Jr. Lima 245, Mercado Andres F. Vivanco";
    private static final String CIUDAD   = "Huamanga - Ayacucho  Telf: 066-312456";
    private static final String BASE_URL = "https://expressvraem.pe/control/";

    public byte[] generarTicket(EncomiendaExterna enc, String operadorNombre) {
        try (PDDocument doc = new PDDocument()) {

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
            String fechaStr = enc.getFechaRecepcion() != null ? enc.getFechaRecepcion().format(dtf) : "—";

            boolean cobrarAlDestinatario = "PENDIENTE".equals(enc.getEstadoPago());
            String  qrContent = BASE_URL + enc.getCorrelativo();
            String  montoStr  = "S/ " + enc.getMonto().toPlainString();

            // Hash de control interno
            String hash = computeHash(
                    enc.getCorrelativo(),
                    enc.getMonto().toPlainString(),
                    enc.getConductorDni() != null ? enc.getConductorDni() : "",
                    fechaStr);

            float pageH = MARGIN + 20
                    + 40             // header empresa
                    + 6              // sep
                    + 72 + 10        // QR + nota
                    + 6              // sep
                    + 22 + 16        // titulo + correlativo
                    + 6              // sep
                    + 8 * 4 + 6      // conductor
                    + 8 * 3 + 6      // destinatario
                    + 8 * 2 + 6      // descripción
                    + 8 * 3 + 6      // cobro + operador
                    + 8 * 5 + 6      // control interno
                    + 20;
            pageH = Math.max(pageH, 500f);

            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                // ── Encabezado empresa ─────────────────────────────────────────
                y = drawCentered(cs, fontBold, 9f, EMPRESA, y);  y -= 2;
                y = drawCentered(cs, fontNorm, 7f, RUC, y);      y -= 1;
                y = drawCentered(cs, fontNorm, 6f, DIR, y);      y -= 1;
                y = drawCentered(cs, fontNorm, 6f, CIUDAD, y);   y -= 4;
                y = drawDashes(cs, y);                            y -= 3;

                // ── QR de verificación ─────────────────────────────────────────
                PDImageXObject qrImg = buildQrImage(doc, qrContent);
                float qrSize = 68f;
                cs.drawImage(qrImg, (PAGE_W - qrSize) / 2f, y - qrSize, qrSize, qrSize);
                y -= (qrSize + 3);
                y = drawCentered(cs, fontNorm, 5.5f, "Escanea para verificar este ticket", y); y -= 2;
                y = drawDashes(cs, y); y -= 3;

                // ── Título del ticket ──────────────────────────────────────────
                y = drawCentered(cs, fontBold, 9f,  "TICKET DE CONTROL INTERNO", y);  y -= 2;
                y = drawCentered(cs, fontBold, 11f, enc.getCorrelativo(), y);          y -= 2;
                y = drawCentered(cs, fontNorm, 7f,  "Fecha: " + fechaStr, y);         y -= 4;
                y = drawDashes(cs, y);                                                  y -= 3;

                // ── Conductor externo ──────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "CONDUCTOR:", enc.getConductorNombre(), y);   y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DNI cond.:", enc.getConductorDni(), y);      y -= 1;
                if (enc.getConductorTel() != null && !enc.getConductorTel().isBlank()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. cond.:", enc.getConductorTel(), y); y -= 1;
                }
                if (enc.getConductorPlaca() != null && !enc.getConductorPlaca().isBlank()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Placa:", enc.getConductorPlaca().toUpperCase(), y); y -= 1;
                }
                y -= 2;

                // ── Destinatario ───────────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DESTINATARIO:", enc.getDestinatarioNombre(), y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DNI dest.:", enc.getDestinatarioDni(), y);       y -= 1;
                if (enc.getDestinatarioTel() != null && !enc.getDestinatarioTel().isBlank()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. dest.:", enc.getDestinatarioTel(), y);  y -= 1;
                }
                y -= 2;

                // ── Descripción ────────────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Descripcion:", enc.getDescripcion(), y); y -= 1;
                if (enc.getObservaciones() != null && !enc.getObservaciones().isBlank()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Obs.:", enc.getObservaciones(), y); y -= 1;
                }
                y -= 2;

                // ── Cobro ──────────────────────────────────────────────────────
                if (cobrarAlDestinatario) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr + " (A COBRAR)", y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Cobro:", "POR COBRAR AL DESTINATARIO", y);
                } else {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr, y);               y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Cobro:", "PAGADO — "
                            + (enc.getFormaPago() != null ? enc.getFormaPago() : ""), y);
                }
                y -= 2;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Operador:", ascii(operadorNombre), y); y -= 3;

                // ── CONTROL INTERNO ────────────────────────────────────────────
                y = drawDashes(cs, y); y -= 2;
                y = drawCentered(cs, fontBold, 7f, "[ CONTROL INTERNO ]", y); y -= 3;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Correlativo:", enc.getCorrelativo(), y);     y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Estado pago:",
                        cobrarAlDestinatario ? "PENDIENTE" : "PAGADO", y);                                y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Verificacion:", qrContent, y);               y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Hash:", hash, y);                             y -= 3;
                y = drawDashes(cs, y); y -= 3;

                // ── Footer ─────────────────────────────────────────────────────
                y = drawCentered(cs, fontObliq, 6.5f, "Conserve este ticket para reclamar.", y);   y -= 1;
                drawCentered(cs, fontNorm, 6f, "Uso interno — Express Quinuapata VRAEM", y);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generando ticket PDF: " + e.getMessage(), e);
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private float drawCentered(PDPageContentStream cs, PDType1Font font, float size,
                                String text, float y) throws Exception {
        String s = ascii(text);
        float tw = font.getStringWidth(s) / 1000f * size;
        cs.beginText(); cs.setFont(font, size);
        cs.newLineAtOffset((PAGE_W - tw) / 2f, y - size); cs.showText(s); cs.endText();
        return y - size - 1;
    }

    private float drawLabel(PDPageContentStream cs, PDType1Font fontB, PDType1Font fontN,
                            float size, String label, String value, float y) throws Exception {
        String sl = ascii(label) + " ";
        cs.beginText(); cs.setFont(fontB, size);
        cs.newLineAtOffset(MARGIN, y - size); cs.showText(sl); cs.endText();
        float lw  = fontB.getStringWidth(sl) / 1000f * size;
        float vx  = MARGIN + lw;
        float maxW = PAGE_W - MARGIN - vx;
        String sv  = ascii(value != null ? value : "-");
        float vw   = fontN.getStringWidth(sv) / 1000f * size;
        if (vw > maxW && sv.length() > 22) sv = sv.substring(0, Math.min(sv.length(), 28)) + "...";
        cs.beginText(); cs.setFont(fontN, size);
        cs.newLineAtOffset(vx, y - size); cs.showText(sv); cs.endText();
        return y - size - 1;
    }

    private float drawDashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y); cs.lineTo(PAGE_W - MARGIN, y); cs.stroke();
        return y - 3;
    }

    private PDImageXObject buildQrImage(PDDocument doc, String text) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 1);
        BitMatrix matrix = writer.encode(text, BarcodeFormat.QR_CODE, 200, 200, hints);
        BufferedImage img = MatrixToImageWriter.toBufferedImage(matrix);
        return LosslessFactory.createFromImage(doc, img);
    }

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
        return s.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')
                .replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U')
                .replace('ñ','n').replace('Ñ','N').replace('ü','u').replace('Ü','U')
                .replace('→','>').replace('—','-').replace('–','-')
                .replace('¡','!').replace('¿','?').replaceAll("[^\\x00-\\x7E]", "?");
    }
}
