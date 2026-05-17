package com.expressvraem.shared.utils;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class ManifiestoGenerator {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    public byte[] generarManifiestoPasajeros(Map<String, Object> viaje, List<Map<String, Object>> pasajeros)
            throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

                float y = 780;
                float margin = 50;

                cs.beginText();
                cs.setFont(bold, 16);
                cs.newLineAtOffset(margin, y);
                cs.showText("EXPRESS QUINUAPATA VRAEM SAC");
                cs.endText();

                y -= 20;
                cs.beginText();
                cs.setFont(regular, 10);
                cs.newLineAtOffset(margin, y);
                cs.showText("MANIFIESTO DE PASAJEROS");
                cs.endText();

                y -= 30;
                cs.beginText();
                cs.setFont(regular, 9);
                cs.newLineAtOffset(margin, y);
                cs.showText("Ruta: " + viaje.getOrDefault("ruta", "-") +
                        "  |  Fecha: " + viaje.getOrDefault("fecha", "-") +
                        "  |  Vehículo: " + viaje.getOrDefault("vehiculo", "-"));
                cs.endText();

                y -= 20;
                cs.beginText();
                cs.setFont(bold, 9);
                cs.newLineAtOffset(margin, y);
                cs.showText(String.format("%-6s %-30s %-12s %-10s", "ASIEN.", "PASAJERO", "DNI", "PRECIO"));
                cs.endText();

                y -= 5;
                cs.moveTo(margin, y);
                cs.lineTo(545, y);
                cs.stroke();
                y -= 15;

                for (Map<String, Object> p : pasajeros) {
                    cs.beginText();
                    cs.setFont(regular, 9);
                    cs.newLineAtOffset(margin, y);
                    cs.showText(String.format("%-6s %-30s %-12s S/%-8s",
                            p.getOrDefault("asiento", ""),
                            truncate(String.valueOf(p.getOrDefault("nombre", "")), 30),
                            p.getOrDefault("dni", ""),
                            p.getOrDefault("precio", "0.00")));
                    cs.endText();
                    y -= 15;
                    if (y < 50) break;
                }

                y -= 20;
                cs.beginText();
                cs.setFont(bold, 9);
                cs.newLineAtOffset(margin, y);
                cs.showText("TOTAL PASAJEROS: " + pasajeros.size());
                cs.endText();

                y -= 40;
                cs.beginText();
                cs.setFont(regular, 9);
                cs.newLineAtOffset(margin, y);
                cs.showText("Generado: " + LocalDateTime.now().format(FMT) + "  |  Firma: ____________________");
                cs.endText();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    public byte[] generarManifiestoCarga(Map<String, Object> viaje, List<Map<String, Object>> encomiendas)
            throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

                float y = 780, margin = 50;

                cs.beginText();
                cs.setFont(bold, 16);
                cs.newLineAtOffset(margin, y);
                cs.showText("EXPRESS QUINUAPATA VRAEM SAC");
                cs.endText();

                y -= 20;
                cs.beginText();
                cs.setFont(regular, 10);
                cs.newLineAtOffset(margin, y);
                cs.showText("MANIFIESTO DE CARGA / ENCOMIENDAS");
                cs.endText();

                y -= 30;
                for (Map<String, Object> e : encomiendas) {
                    cs.beginText();
                    cs.setFont(regular, 9);
                    cs.newLineAtOffset(margin, y);
                    cs.showText(String.format("%-15s %-25s %-10s S/%-8s",
                            e.getOrDefault("codigo", ""),
                            truncate(String.valueOf(e.getOrDefault("descripcion", "")), 25),
                            e.getOrDefault("peso", "") + " kg",
                            e.getOrDefault("precio", "0.00")));
                    cs.endText();
                    y -= 15;
                    if (y < 50) break;
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    private String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max - 2) + ".." : s;
    }
}
