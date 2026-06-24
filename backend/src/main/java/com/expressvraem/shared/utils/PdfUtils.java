package com.expressvraem.shared.utils;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.EnumMap;
import java.util.Map;

/**
 * Utilidades compartidas para generación de PDFs con PDFBox.
 * Centraliza lógica duplicada en TicketPdfService, ComprobantePdfService,
 * EtiquetaPdfService y EncomiendaExternaTicketPdfService.
 */
public final class PdfUtils {

    private PdfUtils() {}

    // ── Sanitización WinAnsiEncoding ─────────────────────────────────────────

    /**
     * Convierte una cadena a caracteres seguros para Helvetica/WinAnsiEncoding.
     * PDFBox lanza IllegalArgumentException si un carácter no está en WinAnsiEncoding
     * (p. ej. U+2192 flecha derecha, emoji, etc.).
     */
    public static String ascii(String s) {
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
            .replace('…','.').replace('‘','\'').replace('’','\'')
            .replace('“','"').replace('”','"')
            .replace('⚠','!').replace('¡','!').replace('¿','?')
            .replaceAll("[\\r\\n\\t]", " ")
            .replaceAll("[^\\x20-\\x7E]", "?");
    }

    // ── Texto multilínea ─────────────────────────────────────────────────────

    /**
     * Parte un texto en líneas que caben en maxW puntos (corte por palabras;
     * palabras más anchas que maxW se trocean por caracteres). Nunca devuelve
     * lista vacía: como mínimo ["-"].
     */
    public static java.util.List<String> wrapText(PDType1Font font, float size, String value, float maxW) {
        String text = ascii(value != null && !value.isBlank() ? value : "-");
        java.util.List<String> lines = new java.util.ArrayList<>();
        try {
            StringBuilder cur = new StringBuilder();
            for (String word : text.split(" ")) {
                while (font.getStringWidth(word) / 1000f * size > maxW && word.length() > 1) {
                    int cut = word.length() - 1;
                    while (cut > 1 && font.getStringWidth(word.substring(0, cut)) / 1000f * size > maxW) cut--;
                    if (cur.length() > 0) { lines.add(cur.toString()); cur.setLength(0); }
                    lines.add(word.substring(0, cut));
                    word = word.substring(cut);
                }
                String cand = cur.length() == 0 ? word : cur + " " + word;
                if (cur.length() > 0 && font.getStringWidth(cand) / 1000f * size > maxW) {
                    lines.add(cur.toString());
                    cur = new StringBuilder(word);
                } else {
                    cur = new StringBuilder(cand);
                }
            }
            if (cur.length() > 0) lines.add(cur.toString());
        } catch (Exception e) {
            lines.clear();
            lines.add(text.length() > 38 ? text.substring(0, 38) : text);
        }
        if (lines.isEmpty()) lines.add("-");
        return lines;
    }

    // ── Hash de verificación ─────────────────────────────────────────────────

    /** SHA-256 de los campos clave, primeros 8 caracteres hex en mayúsculas. */
    public static String sha256Short(String... parts) {
        try {
            String input = String.join("|", parts);
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02X", b & 0xFF));
            return sb.substring(0, 8);
        } catch (Exception e) {
            return "00000000";
        }
    }

    // ── Imagen de logo ───────────────────────────────────────────────────────

    /** Decodifica un logo Base64 y lo convierte a RGB opaco con fondo blanco. */
    public static PDImageXObject buildLogoImage(PDDocument doc, String logoBase64) {
        return buildLogoImage(doc, logoBase64, Color.WHITE);
    }

    /** Decodifica un logo Base64 con un color de fondo específico (útil para etiquetas con fondo de color). */
    public static PDImageXObject buildLogoImage(PDDocument doc, String logoBase64, Color background) {
        if (logoBase64 == null || logoBase64.isBlank()) return null;
        try {
            String b64 = logoBase64.contains(",") ? logoBase64.split(",", 2)[1] : logoBase64;
            byte[] bytes = Base64.getDecoder().decode(b64);
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(bytes));
            if (src == null) return null;
            BufferedImage rgb = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = rgb.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setColor(background);
            g.fillRect(0, 0, src.getWidth(), src.getHeight());
            g.drawImage(src, 0, 0, null);
            g.dispose();
            return LosslessFactory.createFromImage(doc, rgb);
        } catch (Exception e) {
            return null;
        }
    }

    // ── QR Code ──────────────────────────────────────────────────────────────

    /** Genera un QR code como PDImageXObject con el tamaño en píxeles indicado. */
    public static PDImageXObject buildQrImage(PDDocument doc, String text, int pixels) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 1);
        BitMatrix matrix = writer.encode(text, BarcodeFormat.QR_CODE, pixels, pixels, hints);
        BufferedImage img = MatrixToImageWriter.toBufferedImage(matrix);
        return LosslessFactory.createFromImage(doc, img);
    }

    // ── Truncado seguro ──────────────────────────────────────────────────────

    /** Trunca una cadena a maxLen caracteres añadiendo "..." si es necesario. */
    public static String truncate(String s, int maxLen) {
        if (s == null) return "";
        return s.length() > maxLen ? s.substring(0, maxLen - 3) + "..." : s;
    }
}
