package com.expressvraem.modules.encomiendas.service;

import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
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
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ComprobantePdfService {

    private final ClienteRepository clienteRepository;

    private static final float PAGE_W   = 226.77f; // 80mm in points
    private static final float MARGIN   = 10f;
    private static final String EMPRESA = "EXPRESS QUINUAPATA VRAEM S.A.C.";
    private static final String RUC     = "RUC: 20601234567";
    private static final String DIR     = "Jr. Lima 245, Mercado Andrés F. Vivanco";
    private static final String CIUDAD  = "Huamanga - Ayacucho  Telf: 066-312456";

    public byte[] generarComprobante(Encomienda enc) {
        try (PDDocument doc = new PDDocument()) {

            // --- gather data ---
            Cliente rem = clienteRepository.findById(enc.getRemitenteId()).orElse(null);
            Cliente des = clienteRepository.findById(enc.getDestinatarioId()).orElse(null);

            String remNombre  = rem != null ? nombreDisplay(rem) : "—";
            String remDoc     = rem != null ? rem.getTipoDoc() + " " + rem.getNumDoc() : "";
            String remTel     = rem != null && rem.getTelefono() != null ? rem.getTelefono() : "";
            String desNombre  = des != null ? nombreDisplay(des) : "—";
            String desTel     = des != null && des.getTelefono() != null ? des.getTelefono() : "";

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
            String fechaStr = enc.getFechaRegistro() != null
                    ? enc.getFechaRegistro().format(dtf) : "—";

            // First pass to compute page height
            float yEst = MARGIN + 20; // bottom margin
            yEst += 20 + 8 + 8 + 8;  // company header
            yEst += 4;                // separator
            yEst += 10 + 8;          // "COMPROBANTE" + code
            yEst += 60;              // QR
            yEst += 4;               // separator
            yEst += 8 * 12;          // detail lines (approx)
            yEst += 4;               // separator
            yEst += 16;              // footer msg

            float pageH = Math.max(yEst, 400f);
            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                // ── Company header ─────────────────────────
                y = drawCenteredText(cs, fontBold, 9f, EMPRESA, y);
                y -= 2;
                y = drawCenteredText(cs, fontNorm, 7f, RUC, y);
                y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, DIR, y);
                y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, CIUDAD, y);
                y -= 4;

                // ── Separator ──────────────────────────────
                y = drawDashes(cs, y);
                y -= 3;

                // ── Título ─────────────────────────────────
                y = drawCenteredText(cs, fontBold, 8f, "COMPROBANTE DE ENCOMIENDA", y);
                y -= 2;
                y = drawCenteredText(cs, fontBold, 10f, enc.getCodigoTracking(), y);
                y -= 4;

                // ── QR code ────────────────────────────────
                PDImageXObject qrImg = buildQrImage(doc, enc.getCodigoTracking());
                float qrSize = 70f;
                float qrX = (PAGE_W - qrSize) / 2f;
                cs.drawImage(qrImg, qrX, y - qrSize, qrSize, qrSize);
                y -= (qrSize + 4);

                // ── Separator ──────────────────────────────
                y = drawDashes(cs, y);
                y -= 3;

                // ── Remitente ──────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "REMITENTE:", remNombre, y);
                y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Documento:", remDoc, y);
                if (!remTel.isEmpty()) {
                    y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Teléfono:", remTel, y);
                }
                y -= 3;

                // ── Destinatario ───────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DESTINATARIO:", desNombre, y);
                y -= 1;
                if (!desTel.isEmpty()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Teléfono:", desTel, y);
                    y -= 1;
                }
                y -= 3;

                // ── Descripción ────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Contenido:", enc.getDescripcion(), y);
                if (enc.getPesoKg() != null) {
                    y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Peso:", enc.getPesoKg() + " kg", y);
                }
                y -= 3;

                // ── Cobro ──────────────────────────────────
                String montoStr = enc.getMonto() != null
                        ? "S/ " + enc.getMonto().toPlainString() : "S/ " + enc.getPrecioEnvio().toPlainString();
                String cobro = enc.getFormaCobro() != null ? enc.getFormaCobro() : "EFECTIVO";
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr, y);
                y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Forma pago:", cobro, y);
                y -= 3;

                // ── Fecha ──────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Fecha registro:", fechaStr, y);
                y -= 3;

                // ── Separator ──────────────────────────────
                y = drawDashes(cs, y);
                y -= 3;

                // ── Footer ─────────────────────────────────
                String footerMsg = "Conserve este comprobante para";
                String footerMsg2 = "rastrear su encomienda";
                y = drawCenteredText(cs, fontObliq, 6.5f, footerMsg, y);
                y -= 1;
                y = drawCenteredText(cs, fontObliq, 6.5f, footerMsg2, y);
                y -= 2;
                y = drawCenteredText(cs, fontNorm, 6f, "Estado: " + enc.getEstado(), y);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generando comprobante PDF: " + e.getMessage(), e);
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private String nombreDisplay(Cliente c) {
        if ("EMPRESA".equals(c.getTipo()) && c.getRazonSocial() != null) return c.getRazonSocial();
        return c.getApellidos() + ", " + c.getNombres();
    }

    private float drawCenteredText(PDPageContentStream cs, PDType1Font font, float size,
                                   String text, float y) throws Exception {
        float tw = font.getStringWidth(text) / 1000f * size;
        float x  = (PAGE_W - tw) / 2f;
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y - size);
        cs.showText(text);
        cs.endText();
        return y - size - 1;
    }

    private float drawLabel(PDPageContentStream cs, PDType1Font fontB, PDType1Font fontN,
                            float size, String label, String value, float y) throws Exception {
        cs.beginText();
        cs.setFont(fontB, size);
        cs.newLineAtOffset(MARGIN, y - size);
        cs.showText(label + " ");
        cs.endText();

        float labelW = fontB.getStringWidth(label + " ") / 1000f * size;
        float valueX = MARGIN + labelW;
        float maxW   = PAGE_W - MARGIN - valueX;

        // Wrap value if too wide
        String display = value;
        float valW = fontN.getStringWidth(value) / 1000f * size;
        if (valW > maxW && value.length() > 20) {
            display = value.substring(0, Math.min(value.length(), 30)) + "…";
        }

        cs.beginText();
        cs.setFont(fontN, size);
        cs.newLineAtOffset(valueX, y - size);
        cs.showText(display);
        cs.endText();
        return y - size - 1;
    }

    private float drawDashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y);
        cs.lineTo(PAGE_W - MARGIN, y);
        cs.stroke();
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
}
