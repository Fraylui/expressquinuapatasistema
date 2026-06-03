package com.expressvraem.modules.auditoria.service;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
public class AuditoriaPdfService {

    private static final float W        = PDRectangle.A4.getWidth();
    private static final float H        = PDRectangle.A4.getHeight();
    private static final float ML       = 40f;
    private static final float MR       = 40f;
    private static final float CW       = W - ML - MR;
    private static final DateTimeFormatter DTF  = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    // Column x-positions  [hora(45) usuario(80) modulo(60) accion(42) entidad(58) detalle(155) ip(75)] = 515
    private static final float[] COLS  = { ML, ML+45, ML+125, ML+185, ML+227, ML+285, ML+440 };
    private static final String[] HDR  = { "Hora", "Usuario", "Módulo", "Acción", "Entidad", "Detalle", "IP" };

    public byte[] generarReporte(List<Auditoria> logs, Map<String, Object> resumen,
                                  LocalDateTime desde, LocalDateTime hasta) {
        try (PDDocument doc = new PDDocument()) {
            PDType1Font bold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font norm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font obliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDPageContentStream cs = new PDPageContentStream(doc, page);
            float y = H - 40f;

            // Header
            y = centered(cs, bold, 13f, "EXPRESS QUINUAPATA VRAEM S.A.C.", y); y -= 2;
            y = centered(cs, norm, 8f, "RUC: 20601234567  |  Sistema de Transporte Interprovincial — VRAEM", y); y -= 8;
            line(cs, ML, y, W - MR, y); y -= 10;
            y = centered(cs, bold, 12f, "REGISTRO DE AUDITORÍA DEL SISTEMA", y); y -= 4;
            String rango = (desde != null ? desde.format(DATE) : "—") + " al " + (hasta != null ? hasta.format(DATE) : "—");
            y = centered(cs, obliq, 8f, "Período: " + rango + "   |   Generado: " + LocalDateTime.now().format(DTF), y); y -= 10;
            line(cs, ML, y, W - MR, y); y -= 12;

            // Summary row
            Object[] keys = { "total", resumen.get("total"), "INSERT", resumen.get("inserts"),
                               "UPDATE", resumen.get("updates"), "DELETE", resumen.get("deletes"),
                               "LOGIN", resumen.get("logins") };
            y = drawSummaryRow(cs, bold, norm, y, keys); y -= 12;
            line(cs, ML, y, W - MR, y); y -= 10;

            // Table header
            y = drawTableRow(cs, bold, 7.5f, HDR, y, true); y -= 4;
            line(cs, ML, y, W - MR, y); y -= 3;

            // Rows
            for (Auditoria a : logs) {
                if (y < 60) {
                    // new page
                    cs.close();
                    page = new PDPage(PDRectangle.A4);
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);
                    y = H - 40f;
                    y = drawTableRow(cs, bold, 7.5f, HDR, y, true); y -= 4;
                    line(cs, ML, y, W - MR, y); y -= 3;
                }
                String hora     = a.getFecha() != null ? a.getFecha().format(DateTimeFormatter.ofPattern("dd/MM HH:mm")) : "—";
                String usuario  = trunc(a.getUsuarioNombre(), 16);
                String modulo   = trunc(a.getModulo(), 11);
                String accion   = a.getAccion() != null ? a.getAccion() : "";
                String entidad  = trunc(a.getEntidad(), 10);
                String detalle  = trunc(a.getDetalle(), 28);
                String ip       = trunc(a.getIp(), 14);
                String[] vals = { hora, usuario, modulo, accion, entidad, detalle, ip };
                y = drawTableRow(cs, norm, 7f, vals, y, false); y -= 1;
            }

            y -= 6;
            line(cs, ML, y, W - MR, y); y -= 8;
            cs.beginText(); cs.setFont(norm, 8f);
            cs.newLineAtOffset(ML, y - 8f);
            cs.showText("Total de registros: " + logs.size());
            cs.endText();

            // Footer
            cs.beginText(); cs.setFont(norm, 7f);
            cs.newLineAtOffset(ML, 25f);
            cs.showText("Express Quinuapata VRAEM S.A.C.  |  Reporte de auditoría generado el " + LocalDateTime.now().format(DTF));
            cs.endText();

            cs.close();
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error generando PDF de auditoría: " + e.getMessage(), e);
        }
    }

    private float drawSummaryRow(PDPageContentStream cs, PDType1Font bold, PDType1Font norm, float y, Object[] pairs) throws Exception {
        float x = ML;
        float boxW = CW / (pairs.length / 2f);
        for (int i = 0; i < pairs.length; i += 2) {
            String label = String.valueOf(pairs[i]);
            String value = String.valueOf(pairs[i + 1]);
            cs.beginText(); cs.setFont(norm, 7f);
            float lw = norm.getStringWidth(label) / 1000f * 7f;
            cs.newLineAtOffset(x + (boxW - lw) / 2f, y - 7f);
            cs.showText(label); cs.endText();
            cs.beginText(); cs.setFont(bold, 11f);
            float vw = bold.getStringWidth(value) / 1000f * 11f;
            cs.newLineAtOffset(x + (boxW - vw) / 2f, y - 20f);
            cs.showText(value); cs.endText();
            x += boxW;
        }
        return y - 22f;
    }

    private float drawTableRow(PDPageContentStream cs, PDType1Font font, float size, String[] vals, float y, boolean header) throws Exception {
        for (int i = 0; i < COLS.length && i < vals.length; i++) {
            cs.beginText(); cs.setFont(font, size);
            cs.newLineAtOffset(COLS[i], y - size);
            cs.showText(vals[i] != null ? vals[i] : "");
            cs.endText();
        }
        return y - size - 2;
    }

    private float centered(PDPageContentStream cs, PDType1Font font, float size, String text, float y) throws Exception {
        float tw = font.getStringWidth(text) / 1000f * size;
        cs.beginText(); cs.setFont(font, size);
        cs.newLineAtOffset((W - tw) / 2f, y - size);
        cs.showText(text); cs.endText();
        return y - size - 2;
    }

    private void line(PDPageContentStream cs, float x1, float y, float x2, float y2) throws Exception {
        cs.setLineWidth(0.4f);
        cs.moveTo(x1, y); cs.lineTo(x2, y2); cs.stroke();
    }

    private String trunc(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max - 1) + "…" : s;
    }
}
