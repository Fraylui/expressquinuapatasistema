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

    private static final float MARGIN = 50f;
    private static final float PAGE_W = PDRectangle.A4.getWidth();
    private static final float PAGE_H = PDRectangle.A4.getHeight();

    private static final DateTimeFormatter FMT_FECHA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter FMT_HORA  = DateTimeFormatter.ofPattern("HH:mm");

    // ─── Manifiesto completo (multi-página) ──────────────────────────────────────

    public byte[] generarManifiesto(ManifiestoDTO m) throws IOException {
        try (PDDocument doc = new PDDocument()) {

            // Gestión manual del content stream para poder paginar
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDPageContentStream cs = new PDPageContentStream(doc, page);
            int pageNum = 1;
            float y = PAGE_H - MARGIN;

            // Encabezado y datos del viaje (sólo primera página)
            y = drawEncabezado(cs, m, y);
            y -= 8;
            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 12;
            y = drawDatosViaje(cs, m, y);
            y -= 8;
            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 14;

            // ── Tabla de pasajeros ──
            y = drawSeccionTitulo(cs, "LISTA DE PASAJEROS", y);
            y -= 4;
            y = drawTablaEncabezadoPasajeros(cs, y);
            y -= 4;

            for (ManifiestoDTO.PasajeroItem p : m.getPasajeros()) {
                if (y < MARGIN + 80) {
                    drawPiePagina(cs, pageNum, m);
                    cs.close();
                    pageNum++;
                    page = new PDPage(PDRectangle.A4);
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);
                    y = PAGE_H - MARGIN;
                    y = drawTablaEncabezadoPasajeros(cs, y);
                    y -= 4;
                }
                y = drawFilaPasajero(cs, p, y);
            }

            // Totales de pasajeros
            y -= 6;
            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 12;
            y = drawTotalesPasajeros(cs, m, y);

            // ── Tabla de encomiendas (si hay) ──
            List<ManifiestoDTO.EncomiendaItem> encomiendas = m.getEncomiendas();
            if (encomiendas != null && !encomiendas.isEmpty()) {
                // Asegurar espacio mínimo para encabezado de sección
                if (y < MARGIN + 100) {
                    drawPiePagina(cs, pageNum, m);
                    cs.close();
                    pageNum++;
                    page = new PDPage(PDRectangle.A4);
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);
                    y = PAGE_H - MARGIN;
                }
                y -= 14;
                drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
                y -= 12;
                y = drawSeccionTitulo(cs, "ENCOMIENDAS / CARGA", y);
                y -= 4;
                y = drawTablaEncabezadoEncomiendas(cs, y);
                y -= 4;

                String grupoActual = null;
                for (ManifiestoDTO.EncomiendaItem ei : encomiendas) {
                    boolean nuevoGrupo = ei.getAgenciaDestino() != null
                            && !ei.getAgenciaDestino().equals(grupoActual);
                    if (y < MARGIN + (nuevoGrupo ? 84 : 70)) {
                        drawPiePagina(cs, pageNum, m);
                        cs.close();
                        pageNum++;
                        page = new PDPage(PDRectangle.A4);
                        doc.addPage(page);
                        cs = new PDPageContentStream(doc, page);
                        y = PAGE_H - MARGIN;
                        y = drawTablaEncabezadoEncomiendas(cs, y);
                        y -= 4;
                    }
                    if (nuevoGrupo) {
                        grupoActual = ei.getAgenciaDestino();
                        y = drawGrupoDestino(cs, grupoActual, contarGrupo(encomiendas, grupoActual), y);
                    }
                    y = drawFilaEncomienda(cs, ei, y);
                }

                y -= 6;
                drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
                y -= 12;
                y = drawTotalesEncomiendas(cs, m, y);
            }

            // ── Firmas y pie de última página ──
            if (y < MARGIN + 80) {
                drawPiePagina(cs, pageNum, m);
                cs.close();
                pageNum++;
                page = new PDPage(PDRectangle.A4);
                doc.addPage(page);
                cs = new PDPageContentStream(doc, page);
                y = PAGE_H - MARGIN;
            }
            y -= 30;
            drawFirmas(cs, m, y);
            drawPiePagina(cs, pageNum, m);
            cs.close();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        }
    }

    // ─── Manifiesto exclusivo de encomiendas ──────────────────────────────────────

    public byte[] generarManifiestoEncomiendas(ManifiestoDTO m) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDPageContentStream cs = new PDPageContentStream(doc, page);
            int pageNum = 1;
            float y = PAGE_H - MARGIN;

            // Encabezado
            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 13);
            cs.newLineAtOffset(MARGIN, y);
            cs.showText(nullSafe(m.getAgenciaNombre()));
            cs.endText();
            y -= 14;

            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 8);
            cs.newLineAtOffset(MARGIN, y);
            cs.showText(nullSafe(m.getAgenciaDireccion()) + "  |  RUC: " + nullSafe(m.getAgenciaRuc()));
            cs.endText();
            y -= 16;

            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 11);
            cs.newLineAtOffset(MARGIN, y);
            cs.showText(m.getTituloDocumento() != null
                    ? ascii(m.getTituloDocumento())
                    : "MANIFIESTO DE ENCOMIENDAS / GUIA DE CARGA");
            cs.endText();
            y -= 10;

            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 8);
            cs.newLineAtOffset(MARGIN, y);
            cs.showText("Documento requerido por el MTC - Ley 27181 y Reglamento Nacional de Transporte");
            cs.endText();
            y -= 10;

            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 12;

            // Datos del viaje
            // timestamptz llega normalizado a UTC — mostrar siempre en hora local
            java.time.OffsetDateTime salLocal = m.getFechaHoraSal() != null
                    ? m.getFechaHoraSal().atZoneSameInstant(java.time.ZoneId.of("America/Lima")).toOffsetDateTime()
                    : null;
            String fecha = salLocal != null ? salLocal.format(FMT_FECHA) : "-";
            String hora  = salLocal != null ? salLocal.format(FMT_HORA)  : "-";
            String[][] filas = {
                {"Ruta:",    ascii(m.getRutaOrigen()) + " > " + ascii(m.getRutaDestino()),
                 "Fecha:",   fecha, "Hora:", hora},
                {"Vehiculo:", nullSafe(m.getVehiculoPlaca()) + " (" + nullSafe(m.getVehiculoTipo()) + ")",
                 "Conductor:", nullSafe(m.getConductorNombre()), "Licencia:", nullSafe(m.getConductorLicencia())},
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

            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 14;

            // Tabla encomiendas
            y = drawSeccionTitulo(cs, "ENCOMIENDAS / CARGA", y);
            y -= 4;
            y = drawTablaEncabezadoEncomiendas(cs, y);
            y -= 4;

            List<ManifiestoDTO.EncomiendaItem> encomiendas = m.getEncomiendas();
            if (encomiendas == null || encomiendas.isEmpty()) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE), 9);
                cs.newLineAtOffset(MARGIN + 4, y - 14);
                cs.showText("No hay encomiendas registradas para este viaje.");
                cs.endText();
                y -= 30;
            } else {
                String grupoActual = null;
                for (ManifiestoDTO.EncomiendaItem ei : encomiendas) {
                    boolean nuevoGrupo = ei.getAgenciaDestino() != null
                            && !ei.getAgenciaDestino().equals(grupoActual);
                    if (y < MARGIN + (nuevoGrupo ? 84 : 70)) {
                        drawPiePaginaEnc(cs, pageNum, m);
                        cs.close();
                        pageNum++;
                        page = new PDPage(PDRectangle.A4);
                        doc.addPage(page);
                        cs = new PDPageContentStream(doc, page);
                        y = PAGE_H - MARGIN;
                        y = drawTablaEncabezadoEncomiendas(cs, y);
                        y -= 4;
                    }
                    if (nuevoGrupo) {
                        grupoActual = ei.getAgenciaDestino();
                        y = drawGrupoDestino(cs, grupoActual, contarGrupo(encomiendas, grupoActual), y);
                    }
                    y = drawFilaEncomienda(cs, ei, y);
                }
                y -= 6;
                drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
                y -= 12;
                y = drawTotalesEncomiendas(cs, m, y);
            }

            // Firmas
            if (y < MARGIN + 60) {
                drawPiePaginaEnc(cs, pageNum, m);
                cs.close();
                pageNum++;
                page = new PDPage(PDRectangle.A4);
                doc.addPage(page);
                cs = new PDPageContentStream(doc, page);
                y = PAGE_H - MARGIN;
            }
            y -= 30;
            drawFirmas(cs, m, y);
            drawPiePaginaEnc(cs, pageNum, m);
            cs.close();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        }
    }

    private void drawPiePaginaEnc(PDPageContentStream cs, int pagina, ManifiestoDTO m) throws IOException {
        String pie = nullSafe(m.getAgenciaNombre()) + "  -  Guia Encomiendas Viaje #" + m.getViajeId() +
                "  -  Pag. " + pagina + "  -  Generado: " + java.time.LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE), 6.5f);
        cs.newLineAtOffset(MARGIN, 20);
        cs.showText(ascii(pie));
        cs.endText();
    }

    // ─── Ticket individual ────────────────────────────────────────────────────────

    public byte[] generarTicket(TicketData t) throws IOException {
        PDRectangle ticketSize = new PDRectangle(298f, 165f);
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(ticketSize);
            doc.addPage(page);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float w = ticketSize.getWidth();
                float h = ticketSize.getHeight();
                float y = h - 12f;
                float lm = 14f;

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 9);
                cs.newLineAtOffset(lm, y);
                cs.showText(nullSafe(t.agenciaNombre()));
                cs.endText();
                y -= 11;

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7);
                cs.newLineAtOffset(lm, y);
                cs.showText("RUC: " + nullSafe(t.ruc()));
                cs.endText();
                y -= 10;

                drawLine(cs, lm, w - lm, y);
                y -= 9;

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 8);
                cs.newLineAtOffset(lm, y);
                cs.showText("BOLETO: " + nullSafe(t.serie()) + "-" + nullSafe(t.correlativo()));
                cs.endText();
                y -= 10;

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 9);
                cs.newLineAtOffset(lm, y);
                cs.showText(nullSafe(t.origen()) + "  >  " + nullSafe(t.destino()));
                cs.endText();
                y -= 10;

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7.5f);
                cs.newLineAtOffset(lm, y);
                cs.showText("Fecha: " + nullSafe(t.fecha()) + "   Hora: " + nullSafe(t.hora()));
                cs.endText();
                y -= 10;

                drawLine(cs, lm, w - lm, y);
                y -= 9;

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

                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7);
                cs.newLineAtOffset(lm, y);
                cs.showText("Vehiculo: " + nullSafe(t.placa()) + " (" + nullSafe(t.tipoVehiculo()) + ")");
                cs.endText();
                y -= 10;

                drawLine(cs, lm, w - lm, y);
                y -= 9;

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

    // ─── Helpers de dibujo ────────────────────────────────────────────────────────

    private float drawEncabezado(PDPageContentStream cs, ManifiestoDTO m, float y) throws IOException {
        String empresa = nullSafe(m.getAgenciaNombre());

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 13);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText(empresa);
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
        cs.showText("MANIFIESTO DE PASAJEROS Y CARGA");
        cs.endText();
        y -= 10;

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 8);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText("Documento requerido por el MTC - Ley 27181 y Reglamento Nacional de Transporte");
        cs.endText();

        return y - 6;
    }

    private float drawDatosViaje(PDPageContentStream cs, ManifiestoDTO m, float y) throws IOException {
        // timestamptz llega normalizado a UTC — mostrar siempre en hora local
        java.time.OffsetDateTime salLocal = m.getFechaHoraSal() != null
                ? m.getFechaHoraSal().atZoneSameInstant(java.time.ZoneId.of("America/Lima")).toOffsetDateTime()
                : null;
        String fecha = salLocal != null ? salLocal.format(FMT_FECHA) : "-";
        String hora  = salLocal != null ? salLocal.format(FMT_HORA)  : "-";

        String[][] filas = {
            {"Ruta:",     ascii(m.getRutaOrigen()) + " > " + ascii(m.getRutaDestino()),
             "Fecha:",    fecha,
             "Hora:",     hora},
            {"Vehiculo:", nullSafe(m.getVehiculoPlaca()) + " (" + nullSafe(m.getVehiculoTipo()) + ")",
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

    private float drawSeccionTitulo(PDPageContentStream cs, String titulo, float y) throws IOException {
        cs.setNonStrokingColor(0.94f, 0.95f, 0.98f);
        cs.addRect(MARGIN, y - 4, PAGE_W - MARGIN * 2, 14);
        cs.fill();
        cs.setNonStrokingColor(0f, 0f, 0f);

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 8.5f);
        cs.setNonStrokingColor(0.12f, 0.22f, 0.39f);
        cs.newLineAtOffset(MARGIN + 4, y + 1);
        cs.showText(titulo);
        cs.endText();
        cs.setNonStrokingColor(0f, 0f, 0f);

        return y - 16;
    }

    private float drawTablaEncabezadoPasajeros(PDPageContentStream cs, float y) throws IOException {
        String[] cols = {"#", "Apellidos y Nombres", "Tipo", "N Doc", "Asiento", "Precio"};
        float[] xs = colXPasajeros();

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
        float[] xs = colXPasajeros();
        String[] vals = {
            String.valueOf(p.getItem()),
            truncate(p.getApellidos() + ", " + p.getNombres(), 30),
            nullSafe(p.getTipoDoc()),
            nullSafe(p.getNumDoc()),
            String.valueOf(p.getNumAsiento()),
            "S/ " + (p.getPrecioFinal() != null ? p.getPrecioFinal().toPlainString() : "-")
        };

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

    private float drawTotalesPasajeros(PDPageContentStream cs, ManifiestoDTO m, float y) throws IOException {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 8.5f);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText("Total pasajeros: " + m.getTotalPasajeros() +
                "     Total recaudado pasajes: S/ " +
                (m.getTotalRecaudado() != null ? m.getTotalRecaudado().toPlainString() : "-"));
        cs.endText();
        return y - 14;
    }

    /** Subencabezado de grupo: agencia donde baja la carga que sigue. */
    private float drawGrupoDestino(PDPageContentStream cs, String agencia, long cantidad, float y) throws IOException {
        cs.setNonStrokingColor(0.90f, 0.93f, 0.90f);
        cs.addRect(MARGIN, y - 3, PAGE_W - MARGIN * 2, 12);
        cs.fill();
        cs.setNonStrokingColor(0f, 0f, 0f);

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 7.5f);
        cs.setNonStrokingColor(0.05f, 0.30f, 0.15f);
        cs.newLineAtOffset(MARGIN + 4, y);
        cs.showText("BAJA EN: " + ascii(agencia).toUpperCase()
                + "  (" + cantidad + (cantidad == 1 ? " encomienda)" : " encomiendas)"));
        cs.endText();
        cs.setNonStrokingColor(0f, 0f, 0f);
        return y - 14;
    }

    private long contarGrupo(List<ManifiestoDTO.EncomiendaItem> items, String agencia) {
        return items.stream().filter(ei -> agencia.equals(ei.getAgenciaDestino())).count();
    }

    private float drawTablaEncabezadoEncomiendas(PDPageContentStream cs, float y) throws IOException {
        String[] cols = {"#", "Tracking", "Descripcion", "Kg", "Bult.", "Precio", "Remitente"};
        float[] xs = colXEncomiendas();

        cs.setNonStrokingColor(0.35f, 0.22f, 0.10f);
        cs.addRect(MARGIN, y - 4, PAGE_W - MARGIN * 2, 14);
        cs.fill();
        cs.setNonStrokingColor(0f, 0f, 0f);

        for (int i = 0; i < cols.length; i++) {
            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 7f);
            cs.setNonStrokingColor(1f, 1f, 1f);
            cs.newLineAtOffset(xs[i] + 2, y + 1);
            cs.showText(cols[i]);
            cs.endText();
        }
        cs.setNonStrokingColor(0f, 0f, 0f);
        return y - 16;
    }

    private float drawFilaEncomienda(PDPageContentStream cs, ManifiestoDTO.EncomiendaItem ei, float y) throws IOException {
        float[] xs = colXEncomiendas();
        String[] vals = {
            String.valueOf(ei.getItem()),
            nullSafe(ei.getCodigoTracking()),
            truncate(ei.getDescripcion(), 20),
            ei.getPesoKg() != null ? ei.getPesoKg().toPlainString() : "-",
            ei.getNumBultos() != null ? String.valueOf(ei.getNumBultos()) : "-",
            "S/ " + (ei.getPrecioEnvio() != null ? ei.getPrecioEnvio().toPlainString() : "-"),
            truncate(ei.getRemitente(), 22)
        };

        if (ei.getItem() % 2 == 0) {
            cs.setNonStrokingColor(0.98f, 0.96f, 0.93f);
            cs.addRect(MARGIN, y - 3, PAGE_W - MARGIN * 2, 11);
            cs.fill();
            cs.setNonStrokingColor(0f, 0f, 0f);
        }

        for (int i = 0; i < vals.length; i++) {
            cs.beginText();
            cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7f);
            cs.newLineAtOffset(xs[i] + 2, y);
            cs.showText(vals[i]);
            cs.endText();
        }
        return y - 12;
    }

    private float drawTotalesEncomiendas(PDPageContentStream cs, ManifiestoDTO m, float y) throws IOException {
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD), 8.5f);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText("Total encomiendas: " + m.getTotalEncomiendas() +
                "     Total flete: S/ " +
                (m.getTotalMontoEncomiendas() != null ? m.getTotalMontoEncomiendas().toPlainString() : "-"));
        cs.endText();
        return y - 14;
    }

    private void drawFirmas(PDPageContentStream cs, ManifiestoDTO m, float y) throws IOException {
        float mid = PAGE_W / 2f;
        drawLine(cs, MARGIN, MARGIN + 120, y);
        drawLine(cs, mid + 20, mid + 160, y);
        y -= 11;

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7.5f);
        cs.newLineAtOffset(MARGIN + 25, y);
        cs.showText("Firma del Conductor");
        cs.endText();

        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 7.5f);
        cs.newLineAtOffset(mid + 50, y);
        cs.showText(m.getFirmaDerecha() != null ? ascii(m.getFirmaDerecha()) : "Firma del Administrador");
        cs.endText();
    }

    private void drawPiePagina(PDPageContentStream cs, int pagina, ManifiestoDTO m) throws IOException {
        String pie = nullSafe(m.getAgenciaNombre()) + "  -  Viaje #" + m.getViajeId() +
                "  -  Pag. " + pagina + "  -  Generado: " + java.time.LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        cs.beginText();
        cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE), 6.5f);
        cs.newLineAtOffset(MARGIN, 20);
        cs.showText(ascii(pie));
        cs.endText();
    }

    private void drawLine(PDPageContentStream cs, float x1, float x2, float y) throws IOException {
        cs.setStrokingColor(0.7f, 0.7f, 0.7f);
        cs.moveTo(x1, y);
        cs.lineTo(x2, y);
        cs.stroke();
        cs.setStrokingColor(0f, 0f, 0f);
    }

    private float[] colXPasajeros() {
        float x = MARGIN;
        float[] widths = {18, 145, 28, 55, 35, 50};
        float[] xs = new float[widths.length];
        for (int i = 0; i < widths.length; i++) { xs[i] = x; x += widths[i]; }
        return xs;
    }

    private float[] colXEncomiendas() {
        float x = MARGIN;
        float[] widths = {16, 72, 80, 28, 24, 44, 90};
        float[] xs = new float[widths.length];
        for (int i = 0; i < widths.length; i++) { xs[i] = x; x += widths[i]; }
        return xs;
    }

    private String nullSafe(String s) { return s != null ? ascii(s) : "-"; }

    private String truncate(String s, int max) {
        if (s == null) return "-";
        String a = ascii(s);
        return a.length() > max ? a.substring(0, max - 1) + "." : a;
    }

    private String ascii(String s) {
        if (s == null) return "-";
        return s.replace('à','a').replace('á','a').replace('â','a').replace('ã','a').replace('ä','a')
                .replace('è','e').replace('é','e').replace('ê','e').replace('ë','e')
                .replace('ì','i').replace('í','i').replace('î','i').replace('ï','i')
                .replace('ò','o').replace('ó','o').replace('ô','o').replace('õ','o').replace('ö','o')
                .replace('ù','u').replace('ú','u').replace('û','u').replace('ü','u')
                .replace('ñ','n').replace('Á','A').replace('É','E').replace('Í','I')
                .replace('Ó','O').replace('Ú','U').replace('Ñ','N')
                .replace('→','>').replace('—','-').replace('–','-')
                .replaceAll("[^\\x20-\\x7E]", " ");
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
        String tipoVehiculo,
        String agenciaNombre
    ) {}
}
