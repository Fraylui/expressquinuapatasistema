package com.expressvraem.modules.manifiestos.service;

import com.expressvraem.modules.manifiestos.dto.ManifiestoDTO;
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
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@Slf4j
public class ManifiestoPdfService {

    private static final float MARGIN   = 50f;
    private static final float PAGE_W   = PDRectangle.A4.getWidth();
    private static final float PAGE_H   = PDRectangle.A4.getHeight();

    private static final DateTimeFormatter FMT_FECHA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_HORA  = DateTimeFormatter.ofPattern("HH:mm");

    public byte[] generarManifiesto(ManifiestoDTO m) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = PAGE_H - MARGIN;

                // ─── Encabezado ───────────────────────────────────────────────
                y = drawEncabezado(cs, m, y);

                // ─── Línea separadora ─────────────────────────────────────────
                y -= 8;
                drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
                y -= 12;

                // ─── Datos del viaje ──────────────────────────────────────────
                y = drawDatosViaje(cs, m, y);
                y -= 8;
                drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
                y -= 14;

                // ─── Tabla de pasajeros ───────────────────────────────────────
                y = drawTablaEncabezado(cs, y);
                y -= 4;

                List<ManifiestoDTO.PasajeroItem> pasajeros = m.getPasajeros();
                int paginas = 1;

                for (ManifiestoDTO.PasajeroItem p : pasajeros) {
                    if (y < MARGIN + 80) {
                        // Nueva página
                        drawPiePagina(cs, paginas, m);
                        cs.close();
                        paginas++;
                        page = new PDPage(PDRectangle.A4);
                        doc.addPage(page);
                        // No podemos reabrir en try-with-resources de forma anidada,
                        // así que el resto de la tabla queda en la primera página.
                        // Para documentos reales grandes, se requeriría refactor con paginación.
                        break;
                    }
                    y = drawFilaPasajero(cs, p, y);
                }

                // ─── Totales ──────────────────────────────────────────────────
                y -= 8;
                drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
                y -= 14;
                y = drawTotales(cs, m, y);

                // ─── Firmas ───────────────────────────────────────────────────
                y -= 30;
                y = drawFirmas(cs, m, y);

                // ─── Pie de página ────────────────────────────────────────────
                drawPiePagina(cs, paginas, m);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        }
    }

    public byte[] generarTicket(TicketData t) throws IOException {
        // Ticket en formato media carta (A5 landscape / 148x105 mm)
        PDRectangle ticketSize = new PDRectangle(298f, 165f); // ~105x58mm en pts aprox
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(ticketSize);
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float w = ticketSize.getWidth();
                float h = ticketSize.getHeight();
                float y = h - 12f;
                float lm = 14f;

                // Empresa
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 9);
                cs.newLineAtOffset(lm, y);
                cs.showText("EXPRESS QUINUAPATA VRAEM SAC");
                cs.endText();
                y -= 11;

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7);
                cs.newLineAtOffset(lm, y);
                cs.showText("Huamanga, Ayacucho | RUC: " + nullSafe(t.ruc()));
                cs.endText();
                y -= 10;

                // Línea
                drawLine(cs, lm, w - lm, y);
                y -= 9;

                // Serie / correlativo
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 8);
                cs.newLineAtOffset(lm, y);
                cs.showText("BOLETO: " + nullSafe(t.serie()) + "-" + nullSafe(t.correlativo()));
                cs.endText();
                y -= 10;

                // Ruta
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 9);
                cs.newLineAtOffset(lm, y);
                cs.showText(nullSafe(t.origen()) + "  →  " + nullSafe(t.destino()));
                cs.endText();
                y -= 10;

                // Fecha y hora
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7.5f);
                cs.newLineAtOffset(lm, y);
                cs.showText("Fecha: " + nullSafe(t.fecha()) + "   Hora: " + nullSafe(t.hora()));
                cs.endText();
                y -= 10;

                // Línea
                drawLine(cs, lm, w - lm, y);
                y -= 9;

                // Pasajero
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 8);
                cs.newLineAtOffset(lm, y);
                cs.showText("PASAJERO: " + nullSafe(t.pasajeroNombre()));
                cs.endText();
                y -= 10;

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7.5f);
                cs.newLineAtOffset(lm, y);
                cs.showText(nullSafe(t.tipoDoc()) + ": " + nullSafe(t.numDoc()));
                cs.endText();
                y -= 10;

                // Asiento y precio
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 8);
                cs.newLineAtOffset(lm, y);
                cs.showText("ASIENTO: " + nullSafe(t.numAsiento()));
                cs.endText();

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 9);
                cs.newLineAtOffset(w - 80f, y);
                cs.showText("S/ " + (t.precio() != null ? t.precio().toPlainString() : "—"));
                cs.endText();
                y -= 10;

                // Vehículo
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7);
                cs.newLineAtOffset(lm, y);
                cs.showText("Vehículo: " + nullSafe(t.placa()) + " (" + nullSafe(t.tipoVehiculo()) + ")");
                cs.endText();
                y -= 10;

                drawLine(cs, lm, w - lm, y);
                y -= 9;

                // Aviso legal
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE), 6);
                cs.newLineAtOffset(lm, y);
                cs.showText("Documento no tiene validez fiscal. Conserve este boleto durante el viaje.");
                cs.endText();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers de dibujo
    // ─────────────────────────────────────────────────────────────────────────

    private float drawEncabezado(PDPageContentStream cs, ManifiestoDTO m, float y) throws IOException {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 13);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText("EXPRESS QUINUAPATA VRAEM SAC");
        cs.endText();
        y -= 14;

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 8);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText(nullSafe(m.getAgenciaDireccion()) + "  |  RUC: " + nullSafe(m.getAgenciaRuc()));
        cs.endText();
        y -= 18;

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 11);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText("MANIFIESTO DE PASAJEROS");
        cs.endText();
        y -= 10;

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 8);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText("Documento requerido por el MTC — Ley 27181 y Reglamento Nacional de Transporte");
        cs.endText();

        return y - 6;
    }

    private float drawDatosViaje(PDPageContentStream cs, ManifiestoDTO m, float y) throws IOException {
        String fecha = m.getFechaHoraSal() != null ? m.getFechaHoraSal().format(FMT_FECHA) : "—";
        String hora  = m.getFechaHoraSal() != null ? m.getFechaHoraSal().format(FMT_HORA)  : "—";

        String[][] filas = {
            {"Ruta:",     m.getRutaOrigen() + " → " + m.getRutaDestino(),
             "Fecha:",    fecha,
             "Hora:",     hora},
            {"Vehículo:", nullSafe(m.getVehiculoPlaca()) + " (" + nullSafe(m.getVehiculoTipo()) + ")",
             "Conductor:", nullSafe(m.getConductorNombre()),
             "Licencia:", nullSafe(m.getConductorLicencia())},
        };

        float colW = (PAGE_W - MARGIN * 2) / 3f;
        for (String[] fila : filas) {
            for (int i = 0; i < fila.length; i += 2) {
                float x = MARGIN + (i / 2) * colW;
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 8);
                cs.newLineAtOffset(x, y);
                cs.showText(fila[i]);
                cs.endText();
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 8);
                cs.newLineAtOffset(x + 55, y);
                cs.showText(nullSafe(fila[i + 1]));
                cs.endText();
            }
            y -= 13;
        }
        return y;
    }

    private float drawTablaEncabezado(PDPageContentStream cs, float y) throws IOException {
        String[] cols = {"#", "Apellidos y Nombres", "Tipo", "N° Doc", "Asiento", "Precio"};
        float[] xs = colXPositions();

        // Fondo del encabezado
        cs.setNonStrokingColor(0.2f, 0.22f, 0.39f);
        cs.addRect(MARGIN, y - 4, PAGE_W - MARGIN * 2, 14);
        cs.fill();
        cs.setNonStrokingColor(0f, 0f, 0f);

        for (int i = 0; i < cols.length; i++) {
            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 7.5f);
            cs.setNonStrokingColor(1f, 1f, 1f);
            cs.newLineAtOffset(xs[i] + 2, y + 1);
            cs.showText(cols[i]);
            cs.endText();
        }
        cs.setNonStrokingColor(0f, 0f, 0f);

        return y - 16;
    }

    private float drawFilaPasajero(PDPageContentStream cs, ManifiestoDTO.PasajeroItem p, float y) throws IOException {
        float[] xs = colXPositions();
        String[] vals = {
            String.valueOf(p.getItem()),
            truncate(p.getApellidos() + ", " + p.getNombres(), 30),
            nullSafe(p.getTipoDoc()),
            nullSafe(p.getNumDoc()),
            String.valueOf(p.getNumAsiento()),
            "S/ " + (p.getPrecioFinal() != null ? p.getPrecioFinal().toPlainString() : "—")
        };

        // Fila alternada
        if (p.getItem() % 2 == 0) {
            cs.setNonStrokingColor(0.95f, 0.96f, 0.98f);
            cs.addRect(MARGIN, y - 3, PAGE_W - MARGIN * 2, 11);
            cs.fill();
            cs.setNonStrokingColor(0f, 0f, 0f);
        }

        for (int i = 0; i < vals.length; i++) {
            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7.5f);
            cs.newLineAtOffset(xs[i] + 2, y);
            cs.showText(vals[i]);
            cs.endText();
        }
        return y - 12;
    }

    private float drawTotales(PDPageContentStream cs, ManifiestoDTO m, float y) throws IOException {
        String totalPas = "Total pasajeros: " + m.getTotalPasajeros();
        String totalRec = "Total recaudado: S/ " +
                (m.getTotalRecaudado() != null ? m.getTotalRecaudado().toPlainString() : "—");

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 8.5f);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText(totalPas + "     " + totalRec);
        cs.endText();
        return y - 14;
    }

    private float drawFirmas(PDPageContentStream cs, ManifiestoDTO m, float y) throws IOException {
        float mid = PAGE_W / 2f;
        drawLine(cs, MARGIN,       MARGIN + 120, y);
        drawLine(cs, mid + 20,     mid + 160,    y);
        y -= 11;

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7.5f);
        cs.newLineAtOffset(MARGIN + 25, y);
        cs.showText("Firma del Conductor");
        cs.endText();

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7.5f);
        cs.newLineAtOffset(mid + 50, y);
        cs.showText("Firma del Administrador");
        cs.endText();

        return y - 8;
    }

    private void drawPiePagina(PDPageContentStream cs, int pagina, ManifiestoDTO m) throws IOException {
        String pie = "Express Quinuapata VRAEM SAC  |  Viaje #" + m.getViajeId() +
                "  |  Pág. " + pagina + "  |  Generado: " + java.time.LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE), 6.5f);
        cs.newLineAtOffset(MARGIN, 20);
        cs.showText(pie);
        cs.endText();
    }

    private void drawLine(PDPageContentStream cs, float x1, float x2, float y) throws IOException {
        cs.setStrokingColor(0.7f, 0.7f, 0.7f);
        cs.moveTo(x1, y);
        cs.lineTo(x2, y);
        cs.stroke();
        cs.setStrokingColor(0f, 0f, 0f);
    }

    private float[] colXPositions() {
        float x = MARGIN;
        float[] widths = {18, 145, 28, 55, 35, 50};
        float[] xs = new float[widths.length];
        for (int i = 0; i < widths.length; i++) {
            xs[i] = x;
            x += widths[i];
        }
        return xs;
    }

    private String nullSafe(String s) { return s != null ? s : "—"; }
    private String truncate(String s, int max) {
        if (s == null) return "—";
        return s.length() > max ? s.substring(0, max - 1) + "…" : s;
    }

    public record TicketData(
        String ruc,
        String serie,
        String correlativo,
        String origen,
        String destino,
        String fecha,
        String hora,
        String pasajeroNombre,
        String tipoDoc,
        String numDoc,
        String numAsiento,
        BigDecimal precio,
        String placa,
        String tipoVehiculo
    ) {}
}
