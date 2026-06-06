package com.expressvraem.modules.encomiendas.service;

import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import jakarta.persistence.EntityManager;
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
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.EnumMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EtiquetaPdfService {

    private final ClienteRepository clienteRepository;
    private final EntityManager entityManager;

    // 100 mm × 150 mm en puntos (1 mm = 2.8346 pt)
    private static final float W = 283.46f;
    private static final float H = 425.19f;
    private static final float M = 8f;   // margen

    private static final String EMPRESA   = "EXPRESS QUINUAPATA VRAEM S.A.C.";
    private static final String TRACK_URL = "https://expressvraem.pe/tracking/";

    @Transactional(readOnly = true)
    public byte[] generarEtiqueta(Encomienda enc, String operadorNombre) {
        int totalBultos = enc.getNumBultos() != null && enc.getNumBultos() > 1 ? enc.getNumBultos() : 1;

        // Generar una página por bulto
        try (PDDocument doc = new PDDocument()) {
            for (int bulto = 1; bulto <= totalBultos; bulto++) {
                generarPagina(doc, enc, bulto, totalBultos);
            }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error generando etiqueta PDF: " + e.getMessage(), e);
        }
    }

    private void generarPagina(PDDocument doc, Encomienda enc, int bultoNum, int totalBultos) throws Exception {
        PDPage page = new PDPage(new PDRectangle(W, H));
        doc.addPage(page);

        PDType1Font fBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
        PDType1Font fNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        PDType1Font fObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

        // Datos de clientes
        Cliente des = enc.getDestinatarioId() != null
                ? clienteRepository.findById(enc.getDestinatarioId()).orElse(null) : null;
        Cliente rem = enc.getRemitenteId() != null
                ? clienteRepository.findById(enc.getRemitenteId()).orElse(null) : null;

        String desNombre = des != null ? nombreDisplay(des) : "—";
        String desTel    = des != null && des.getTelefono() != null ? des.getTelefono() : "";
        String remNombre = rem != null ? nombreDisplay(rem) : "—";

        // Agencias
        String[] origen  = resolveAgencia(enc.getAgenciaOrigenId());
        String[] destino = resolveAgencia(enc.getAgenciaDestinoId());
        String origenCiudad  = origen[1].toUpperCase();
        String destinoCiudad = destino[1].toUpperCase();

        boolean esPorCobrar = "POR_COBRAR".equals(enc.getFormaCobro());
        String montoStr = enc.getMonto() != null
                ? "S/ " + enc.getMonto().toPlainString()
                : enc.getPrecioEnvio() != null ? "S/ " + enc.getPrecioEnvio().toPlainString() : "—";

        try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
            float y = H - M;

            // ── Franja superior verde: EMPRESA ──────────────────────────────────
            fillRect(cs, 0, H - 22, W, 22, 0.024f, 0.306f, 0.235f); // #064e3b
            y = drawCenteredText(cs, fBold, 8f, EMPRESA, H - 6f, 1f, 1f, 1f);
            y = H - 22 - 3;

            // ── ORIGEN → DESTINO en grande ──────────────────────────────────────
            fillRect(cs, 0, y - 28, W, 28, 0.039f, 0.373f, 0.294f); // #065f46
            String rutaText = origenCiudad + "  →  " + destinoCiudad;
            drawCenteredText(cs, fBold, 13f, rutaText, y - 8f, 1f, 1f, 1f);
            y = y - 28 - 4;

            // ── QR + tracking ────────────────────────────────────────────────────
            float qrSize = 90f;
            String qrContent = TRACK_URL + enc.getCodigoTracking();
            PDImageXObject qrImg = buildQrImage(doc, qrContent);
            float qrX = (W - qrSize) / 2f;
            cs.drawImage(qrImg, qrX, y - qrSize, qrSize, qrSize);
            y -= (qrSize + 2);

            // Código tracking en grande debajo del QR
            y = drawCenteredText(cs, fBold, 11f, enc.getCodigoTracking(), y, 0f, 0f, 0f);
            y -= 2;

            // ── Separador ────────────────────────────────────────────────────────
            drawLine(cs, M, y, W - M, y, 0.8f, 0.5f);
            y -= 5;

            // ── DESTINATARIO (más prominente) ────────────────────────────────────
            y = drawLabel(cs, fBold, fBold, 7f, "PARA:", desNombre, y, 0f, 0f, 0f);
            if (!desTel.isEmpty()) {
                y = drawLabel(cs, fNorm, fNorm, 7f, "Tel:", desTel, y, 0.2f, 0.2f, 0.2f);
            }
            y -= 2;

            // ── Remitente ────────────────────────────────────────────────────────
            y = drawLabel(cs, fNorm, fNorm, 6.5f, "De:", remNombre, y, 0.3f, 0.3f, 0.3f);
            y -= 2;

            // ── Separador ────────────────────────────────────────────────────────
            drawLine(cs, M, y, W - M, y, 0.8f, 0.4f);
            y -= 4;

            // ── Contenido + peso ─────────────────────────────────────────────────
            y = drawLabel(cs, fBold, fNorm, 7f, "Contenido:", enc.getDescripcion(), y, 0f, 0f, 0f);
            String pesoStr = enc.getPesoKg() != null ? enc.getPesoKg() + " kg" : "—";
            y = drawLabel(cs, fBold, fNorm, 7f, "Peso:", pesoStr, y, 0f, 0f, 0f);
            y -= 2;

            // ── BULTO N DE M ─────────────────────────────────────────────────────
            if (totalBultos > 1) {
                String bultoText = "BULTO " + bultoNum + " DE " + totalBultos;
                fillRect(cs, M, y - 14, W - M * 2, 14, 0.9f, 0.9f, 0.9f);
                drawCenteredText(cs, fBold, 9f, bultoText, y - 2f, 0f, 0f, 0f);
                y -= 18;
            }

            // ── FRÁGIL (si aplica) ───────────────────────────────────────────────
            if (enc.isEsFragil()) {
                y -= 2;
                fillRect(cs, M, y - 16, W - M * 2, 16, 1f, 0.95f, 0.8f); // fondo amarillo
                drawLine(cs, M, y - 16, W - M, y - 16, 0.9f, 0.8f);
                drawLine(cs, M, y,       W - M, y,       0.9f, 0.8f);
                drawCenteredText(cs, fBold, 8.5f, "⚠  FRAGIL - MANEJAR CON CUIDADO  ⚠", y - 4f, 0.6f, 0.4f, 0f);
                y -= 20;
            }

            // ── PAGO EN DESTINO (si aplica) ──────────────────────────────────────
            if (esPorCobrar) {
                y -= 2;
                fillRect(cs, M, y - 18, W - M * 2, 18, 1f, 0.95f, 0.9f); // fondo naranja claro
                drawLine(cs, M, y - 18, W - M, y - 18, 0.85f, 0.4f);
                drawLine(cs, M, y,       W - M, y,       0.85f, 0.4f);
                cs.beginText();
                cs.setFont(fBold, 8.5f);
                cs.setNonStrokingColor(0.7f, 0.2f, 0f);
                String cobroLine = "COBRAR AL ENTREGAR:  " + montoStr;
                float tw = fBold.getStringWidth(cobroLine) / 1000f * 8.5f;
                cs.newLineAtOffset((W - tw) / 2f, y - 13f);
                cs.showText(cobroLine);
                cs.endText();
                cs.setNonStrokingColor(0f, 0f, 0f);
                y -= 22;
            }

            // ── Footer ────────────────────────────────────────────────────────────
            y -= 4;
            drawLine(cs, M, y, W - M, y, 0.7f, 0.3f);
            y -= 3;
            if (bultoNum == 1) {
                y = drawCenteredText(cs, fNorm, 5.5f, "Escanee el codigo QR para rastrear este paquete", y, 0.4f, 0.4f, 0.4f);
            }
            drawCenteredText(cs, fObliq, 5.5f, "expressvraem.pe/tracking/" + enc.getCodigoTracking(), y - 1, 0.3f, 0.3f, 0.3f);
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private String nombreDisplay(Cliente c) {
        if ("EMPRESA".equals(c.getTipo()) && c.getRazonSocial() != null) return c.getRazonSocial();
        return c.getApellidos() + ", " + c.getNombres();
    }

    private String[] resolveAgencia(Long agenciaId) {
        if (agenciaId == null) return new String[]{"—", "—"};
        try {
            Object[] ag = (Object[]) entityManager
                .createNativeQuery("SELECT nombre, ciudad FROM agencias WHERE id = :id")
                .setParameter("id", agenciaId).getSingleResult();
            return new String[]{
                ag[0] != null ? String.valueOf(ag[0]) : "—",
                ag[1] != null ? String.valueOf(ag[1]) : "—"
            };
        } catch (Exception e) { return new String[]{"—", "—"}; }
    }

    private float drawCenteredText(PDPageContentStream cs, PDType1Font font, float size,
                                   String text, float y, float r, float g, float b) throws Exception {
        String safe = ascii(text);
        float tw = font.getStringWidth(safe) / 1000f * size;
        cs.beginText();
        cs.setFont(font, size);
        cs.setNonStrokingColor(r, g, b);
        cs.newLineAtOffset((W - tw) / 2f, y - size);
        cs.showText(safe);
        cs.endText();
        cs.setNonStrokingColor(0f, 0f, 0f);
        return y - size - 1.5f;
    }

    private float drawLabel(PDPageContentStream cs, PDType1Font fontLabel, PDType1Font fontValue,
                            float size, String label, String value, float y,
                            float r, float g, float b) throws Exception {
        String safeLabel = ascii(label) + " ";
        cs.beginText(); cs.setFont(fontLabel, size);
        cs.setNonStrokingColor(0.3f, 0.3f, 0.3f);
        cs.newLineAtOffset(M, y - size); cs.showText(safeLabel); cs.endText();

        float lw = fontLabel.getStringWidth(safeLabel) / 1000f * size;
        float maxW = W - M * 2 - lw;
        String display = ascii(value != null ? value : "—");
        if (fontValue.getStringWidth(display) / 1000f * size > maxW && display.length() > 30)
            display = display.substring(0, 30) + "...";

        cs.beginText(); cs.setFont(fontValue, size);
        cs.setNonStrokingColor(r, g, b);
        cs.newLineAtOffset(M + lw, y - size); cs.showText(display); cs.endText();
        cs.setNonStrokingColor(0f, 0f, 0f);
        return y - size - 1.5f;
    }

    private void drawLine(PDPageContentStream cs, float x1, float y, float x2, float y2,
                          float r, float lineW) throws Exception {
        cs.setLineWidth(lineW);
        cs.setStrokingColor(r, r, r);
        cs.moveTo(x1, y); cs.lineTo(x2, y2); cs.stroke();
        cs.setStrokingColor(0f, 0f, 0f);
    }

    private void fillRect(PDPageContentStream cs, float x, float y, float w, float h,
                          float r, float g, float b) throws Exception {
        cs.setNonStrokingColor(r, g, b);
        cs.addRect(x, y, w, h);
        cs.fill();
        cs.setNonStrokingColor(0f, 0f, 0f);
    }

    private PDImageXObject buildQrImage(PDDocument doc, String text) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 1);
        BitMatrix matrix = writer.encode(text, BarcodeFormat.QR_CODE, 300, 300, hints);
        BufferedImage img = MatrixToImageWriter.toBufferedImage(matrix);
        return LosslessFactory.createFromImage(doc, img);
    }

    private String ascii(String s) {
        if (s == null) return "";
        return s.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')
                .replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U')
                .replace('ñ','n').replace('Ñ','N').replace('ü','u')
                .replace('→','>').replace('—','-').replace('⚠','!')
                .replaceAll("[\\r\\n\\t]", " ")
                .replaceAll("[^\\x20-\\x7E]", "?");
    }
}
