package com.expressvraem.modules.caja.service;

import com.expressvraem.modules.caja.entity.MovimientoCaja;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
public class CajaReportePdfService {

    private static final float W        = PDRectangle.A4.getWidth();
    private static final float H        = PDRectangle.A4.getHeight();
    private static final float ML       = 50f;
    private static final float MR       = 50f;
    private static final float MIN_Y    = 70f;
    private static final DateTimeFormatter DTF = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private static final float[] COLS    = {ML, ML + 45, ML + 90, ML + 165, W - MR - 70};
    private static final String[] HEADERS = {"Hora", "Tipo", "Concepto", "Referencia", "Monto"};

    public byte[] generarReporte(Map<String, Object> datos, List<MovimientoCaja> movimientos) {
        try (PDDocument doc = new PDDocument()) {
            PDType1Font fontBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            String fechaGen = LocalDateTime.now().format(DTF);

            // ── Página 1: encabezado + resumen financiero ────────────────────────
            PDPage page1 = new PDPage(PDRectangle.A4);
            doc.addPage(page1);

            PDPageContentStream cs = new PDPageContentStream(doc, page1);
            float y = H - 50f;

            try {
                // Encabezado empresa
                y = drawCentered(cs, fontBold, 13f, "EXPRESS QUINUAPATA VRAEM S.A.C.", y); y -= 3;
                y = drawCentered(cs, fontNorm, 9f, "RUC: 20601234567", y); y -= 3;
                y = drawCentered(cs, fontObliq, 8f, "Sistema de Transporte Interprovincial — VRAEM", y); y -= 10;
                drawLine(cs, ML, y, W - MR, y); y -= 12;

                // Título
                y = drawCentered(cs, fontBold, 14f, "REPORTE DE CIERRE DE TURNO", y); y -= 5;
                y = drawCentered(cs, fontNorm, 8f, "Generado: " + fechaGen, y); y -= 12;
                drawLine(cs, ML, y, W - MR, y); y -= 12;

                // Datos del turno
                y = drawCentered(cs, fontBold, 10f, "DATOS DEL TURNO", y); y -= 8;

                LocalDateTime apertura = (LocalDateTime) datos.get("fechaApertura");
                LocalDateTime cierre   = (LocalDateTime) datos.get("fechaCierre");
                String duracion = "—";
                if (apertura != null && cierre != null) {
                    Duration dur = Duration.between(apertura, cierre);
                    duracion = dur.toHours() + "h " + dur.toMinutesPart() + "min";
                }

                y = drawLabelValue(cs, fontBold, fontNorm, 9f, "Operador:",  str(datos.get("operadorNombre")), y); y -= 2;
                y = drawLabelValue(cs, fontBold, fontNorm, 9f, "Agencia:",   str(datos.get("agenciaNombre")), y);  y -= 2;
                y = drawLabelValue(cs, fontBold, fontNorm, 9f, "Apertura:",  apertura != null ? apertura.format(DTF) : "—", y); y -= 2;
                y = drawLabelValue(cs, fontBold, fontNorm, 9f, "Cierre:",    cierre   != null ? cierre.format(DTF)   : "—", y); y -= 2;
                y = drawLabelValue(cs, fontBold, fontNorm, 9f, "Duración:",  duracion, y); y -= 12;
                drawLine(cs, ML, y, W - MR, y); y -= 12;

                // Resumen financiero
                y = drawCentered(cs, fontBold, 10f, "RESUMEN FINANCIERO", y); y -= 10;

                BigDecimal montoApertura  = bd(datos.get("montoApertura"));
                BigDecimal totalIngresos  = bd(datos.get("totalIngresos"));
                BigDecimal totalEgresos   = bd(datos.get("totalEgresos"));
                BigDecimal montoPasajes   = bd(datos.get("montoPasajes"));
                BigDecimal montoEnc       = bd(datos.get("montoEncomiendas"));
                BigDecimal montoPagoDest  = bd(datos.get("montoPagoDestino"));
                BigDecimal montoExternas  = bd(datos.get("montoExternas"));
                BigDecimal montoCuotas    = bd(datos.get("montoCuotasCombi"));
                BigDecimal saldo          = montoApertura.add(totalIngresos).subtract(totalEgresos);
                BigDecimal montoCierre    = bd(datos.get("montoCierre"));
                BigDecimal diferencia     = bd(datos.get("diferencia"));

                Object[][] rows = {
                    {"Monto inicial:",
                     "S/ " + montoApertura.toPlainString()},
                    {"  Pasajes (" + str(datos.get("cantPasajes")) + "):",
                     "S/ " + montoPasajes.toPlainString()},
                    {"  Encomiendas (" + str(datos.get("cantEncomiendas")) + "):",
                     "S/ " + montoEnc.toPlainString()},
                    {"  Contraentrega (" + str(datos.get("cantPagoDestino")) + "):",
                     "S/ " + montoPagoDest.toPlainString()},
                    {"  Enc. externas (" + str(datos.get("cantExternas")) + "):",
                     "S/ " + montoExternas.toPlainString()},
                    {"  Cuotas combi (" + str(datos.get("cantCuotasCombi")) + "):",
                     "S/ " + montoCuotas.toPlainString()},
                    {"  Total ingresos:",
                     "S/ " + totalIngresos.toPlainString()},
                    {"  Total egresos:",
                     "-S/ " + totalEgresos.toPlainString()},
                    {"Total esperado (sistema):",
                     "S/ " + saldo.toPlainString()},
                    {"Dinero físico contado:",
                     montoCierre != null ? "S/ " + montoCierre.toPlainString() : "—"},
                    {"Diferencia:",
                     diferencia != null
                         ? (diferencia.compareTo(BigDecimal.ZERO) == 0
                             ? "CUADRA (S/ 0.00)"
                             : (diferencia.compareTo(BigDecimal.ZERO) > 0 ? "Sobra S/ " : "Falta S/ ")
                               + diferencia.abs().toPlainString())
                         : "—"},
                };

                for (Object[] row : rows) {
                    String label = (String) row[0];
                    String value = (String) row[1];
                    boolean isBold = label.startsWith("Total") || label.startsWith("Monto")
                            || label.startsWith("Dinero") || label.startsWith("Dif");
                    PDType1Font lf = isBold ? fontBold : fontNorm;

                    cs.beginText(); cs.setFont(lf, 9f);
                    cs.newLineAtOffset(ML, y - 9f); cs.showText(label); cs.endText();

                    float tw = fontNorm.getStringWidth(value) / 1000f * 9f;
                    cs.beginText(); cs.setFont(lf, 9f);
                    cs.newLineAtOffset(W - MR - tw, y - 9f); cs.showText(value); cs.endText();
                    y -= 13f;
                }

                // Observación
                String obs = str(datos.get("observaciones"));
                if (!obs.equals("—") && !obs.isEmpty()) {
                    y -= 8;
                    drawLine(cs, ML, y, W - MR, y); y -= 10;
                    y = drawLabelValue(cs, fontBold, fontObliq, 9f, "Observación:", obs, y); y -= 5;
                }

                y -= 8;
                drawLine(cs, ML, y, W - MR, y); y -= 12;

                // Inicio tabla de movimientos
                y = drawCentered(cs, fontBold, 10f, "DETALLE DE MOVIMIENTOS DEL TURNO", y); y -= 10;
                y = drawTableHeader(cs, fontBold, y); y -= 4;

                // ── Filas de movimientos con soporte multi-página ────────────────
                int pageNum = 1;
                for (MovimientoCaja mov : movimientos) {
                    if (y < MIN_Y) {
                        drawPageFooter(cs, fontNorm, fechaGen, pageNum);
                        cs.close();

                        pageNum++;
                        PDPage newPage = new PDPage(PDRectangle.A4);
                        doc.addPage(newPage);
                        cs = new PDPageContentStream(doc, newPage);
                        y = H - 50f;

                        // Encabezado de continuación
                        y = drawCentered(cs, fontBold, 9f, "EXPRESS QUINUAPATA VRAEM S.A.C. — Movimientos (cont.)", y); y -= 8;
                        drawLine(cs, ML, y, W - MR, y); y -= 10;
                        y = drawTableHeader(cs, fontBold, y); y -= 4;
                    }

                    String hora     = mov.getCreatedAt() != null
                            ? mov.getCreatedAt().format(DateTimeFormatter.ofPattern("HH:mm")) : "—";
                    String tipo     = tipoDisplay(mov);
                    String concepto = mov.getConcepto().length() > 35
                            ? mov.getConcepto().substring(0, 33) + "…" : mov.getConcepto();
                    String ref      = mov.getReferenciaId() != null ? "#" + mov.getReferenciaId() : "";
                    String montoStr = ("EGRESO".equals(mov.getTipo()) ? "-" : "+") + "S/ " + mov.getMonto().toPlainString();
                    boolean esEgreso = "EGRESO".equals(mov.getTipo());

                    String[] vals = {hora, tipo, concepto, ref, montoStr};
                    for (int i = 0; i < vals.length; i++) {
                        cs.beginText();
                        cs.setFont(i == 4 && esEgreso ? fontBold : fontNorm, 7.5f);
                        cs.newLineAtOffset(COLS[i], y - 8f);
                        cs.showText(vals[i]);
                        cs.endText();
                    }
                    y -= 12;
                }

                // Pie de tabla
                y -= 8;
                drawLine(cs, ML, y, W - MR, y); y -= 10;

                cs.beginText(); cs.setFont(fontBold, 9f);
                cs.newLineAtOffset(ML, y - 9f);
                cs.showText("Total movimientos: " + movimientos.size()
                        + "   |   Ingresos: S/ " + totalIngresos.toPlainString()
                        + "   |   Egresos: S/ " + totalEgresos.toPlainString());
                cs.endText();
                y -= 25;

                // Firma
                drawLine(cs, ML, y, ML + 180, y); y -= 10;
                cs.beginText(); cs.setFont(fontNorm, 8f);
                cs.newLineAtOffset(ML, y - 8f);
                cs.showText("Firma del operador");
                cs.endText();

                drawPageFooter(cs, fontNorm, fechaGen, pageNum);

            } finally {
                cs.close();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generando reporte PDF: " + e.getMessage(), e);
        }
    }

    // ── Helpers de dibujo ────────────────────────────────────────────────────────

    private float drawTableHeader(PDPageContentStream cs, PDType1Font fontBold, float y) throws Exception {
        drawTableRow(cs, fontBold, 8f, COLS, HEADERS, y);
        y -= 14;
        drawLine(cs, ML, y, W - MR, y);
        return y;
    }

    private void drawPageFooter(PDPageContentStream cs, PDType1Font fontNorm,
                                 String fechaGen, int pageNum) throws Exception {
        cs.beginText(); cs.setFont(fontNorm, 7f);
        cs.newLineAtOffset(ML, 30f);
        cs.showText("Express Quinuapata VRAEM S.A.C.  |  Reporte generado: " + fechaGen
                + "  |  Página " + pageNum);
        cs.endText();
    }

    private float drawCentered(PDPageContentStream cs, PDType1Font font, float size,
                                String text, float y) throws Exception {
        float tw = font.getStringWidth(text) / 1000f * size;
        cs.beginText(); cs.setFont(font, size);
        cs.newLineAtOffset((W - tw) / 2f, y - size); cs.showText(text); cs.endText();
        return y - size - 2;
    }

    private float drawLabelValue(PDPageContentStream cs, PDType1Font fontL, PDType1Font fontV,
                                  float size, String label, String value, float y) throws Exception {
        cs.beginText(); cs.setFont(fontL, size);
        cs.newLineAtOffset(ML, y - size); cs.showText(label); cs.endText();
        float lw = fontL.getStringWidth(label) / 1000f * size;
        cs.beginText(); cs.setFont(fontV, size);
        cs.newLineAtOffset(ML + lw + 4, y - size); cs.showText(value); cs.endText();
        return y - size - 2;
    }

    private void drawLine(PDPageContentStream cs, float x1, float y1, float x2, float y2) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(x1, y1); cs.lineTo(x2, y2); cs.stroke();
    }

    private void drawTableRow(PDPageContentStream cs, PDType1Font font, float size,
                               float[] cols, String[] vals, float y) throws Exception {
        for (int i = 0; i < cols.length && i < vals.length; i++) {
            cs.beginText(); cs.setFont(font, size);
            cs.newLineAtOffset(cols[i], y - size); cs.showText(vals[i]); cs.endText();
        }
    }

    private String tipoDisplay(MovimientoCaja mov) {
        if ("EGRESO".equals(mov.getTipo()))              return "EGRESO";
        if ("PASAJE".equals(mov.getReferenciaTipo()))    return "PASAJE";
        if ("ENCOMIENDA".equals(mov.getReferenciaTipo())) return "ENCOMIENDA";
        if ("PAGO_DESTINO".equals(mov.getReferenciaTipo())) return "CONTRAENTREGA";
        return "INGRESO";
    }

    private String str(Object o) {
        return o != null ? String.valueOf(o) : "—";
    }

    private BigDecimal bd(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        try { return new BigDecimal(String.valueOf(o)); } catch (Exception e) { return BigDecimal.ZERO; }
    }
}
