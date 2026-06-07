package com.expressvraem.modules.viajes.service;

import com.expressvraem.modules.empresa.service.EmpresaConfigService;
import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import com.expressvraem.modules.viajes.entity.Viaje;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
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
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class LiquidacionViajeService {

    private final ViajeRepository   viajeRepository;
    private final EntityManager     entityManager;
    private final EmpresaConfigService empresaConfigService;

    private static final float MARGIN  = 45f;
    private static final float PAGE_W  = PDRectangle.A4.getWidth();
    private static final float PAGE_H  = PDRectangle.A4.getHeight();
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @SuppressWarnings("unchecked")
    public byte[] generarLiquidacion(Long viajeId) {
        Viaje viaje = viajeRepository.findById(viajeId)
                .orElseThrow(() -> new ResourceNotFoundException("Viaje", viajeId));

        EmpresaConfig emp = empresaConfigService.get();

        // ── Datos del viaje enriquecidos ──────────────────────────────────────
        Object[] rutaRow = null;
        try {
            rutaRow = (Object[]) entityManager
                    .createNativeQuery("SELECT origen, destino FROM rutas WHERE id = :id")
                    .setParameter("id", viaje.getRutaId()).getSingleResult();
        } catch (Exception ignored) {}

        Object[] vehRow = null;
        try {
            vehRow = (Object[]) entityManager
                    .createNativeQuery("SELECT placa, tipo, num_asientos FROM vehiculos WHERE id = :id")
                    .setParameter("id", viaje.getVehiculoId()).getSingleResult();
        } catch (Exception ignored) {}

        String conductorNombre = "—";
        try {
            Object[] condRow = (Object[]) entityManager
                    .createNativeQuery("SELECT nombres || ' ' || apellidos FROM usuarios WHERE id = :id")
                    .setParameter("id", viaje.getConductorId()).getSingleResult();
            conductorNombre = String.valueOf(condRow[0]);
        } catch (Exception ignored) {}

        // ── Pasajes activos ───────────────────────────────────────────────────
        List<Object[]> pasajes = (List<Object[]>) entityManager.createNativeQuery(
                "SELECT p.codigo_boleta, c.apellidos || ', ' || c.nombres, c.num_doc, " +
                "p.asiento_numero, p.precio_final, p.estado, p.forma_pago " +
                "FROM pasajes p LEFT JOIN clientes c ON c.id = p.cliente_id " +
                "WHERE p.viaje_id = :vid AND p.estado != 'ANULADO' " +
                "ORDER BY p.asiento_numero")
                .setParameter("vid", viajeId).getResultList();

        // ── Encomiendas ───────────────────────────────────────────────────────
        List<Object[]> encomiendas = (List<Object[]>) entityManager.createNativeQuery(
                "SELECT e.codigo_tracking, e.descripcion, " +
                "ar.nombre AS agencia_dest, e.precio_envio, e.forma_cobro, e.estado " +
                "FROM encomiendas e " +
                "LEFT JOIN agencias ar ON ar.id = e.agencia_destino_id " +
                "WHERE e.viaje_id = :vid " +
                "ORDER BY e.id")
                .setParameter("vid", viajeId).getResultList();

        // ── Totales ───────────────────────────────────────────────────────────
        BigDecimal totalPasajes = pasajes.stream()
                .map(r -> r[4] != null ? new BigDecimal(r[4].toString()) : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalEncomiendas = encomiendas.stream()
                .filter(r -> !"POR_COBRAR".equals(String.valueOf(r[4])))
                .map(r -> r[3] != null ? new BigDecimal(r[3].toString()) : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // ── Generación PDF ────────────────────────────────────────────────────
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDPageContentStream cs = new PDPageContentStream(doc, page);
            int pageNum = 1;
            float y = PAGE_H - MARGIN;

            PDType1Font BOLD   = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font NORMAL = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font MONO   = new PDType1Font(Standard14Fonts.FontName.COURIER);

            // ── Encabezado empresa ────────────────────────────────────────────
            y = drawCentered(cs, BOLD, 13f, emp.getNombre(), y);
            y -= 3;
            if (emp.getRuc() != null && !emp.getRuc().isBlank()) {
                y = drawCentered(cs, NORMAL, 9f, "RUC: " + emp.getRuc(), y);
                y -= 1;
            }
            if (emp.getDireccion() != null && !emp.getDireccion().isBlank()) {
                y = drawCentered(cs, NORMAL, 9f, emp.getDireccion()
                        + (emp.getCiudad() != null && !emp.getCiudad().isBlank() ? " — " + emp.getCiudad() : ""), y);
                y -= 1;
            }
            y -= 6;
            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 12;

            // ── Título ────────────────────────────────────────────────────────
            y = drawCentered(cs, BOLD, 12f, "LIQUIDACIÓN DE VIAJE N° " + viajeId, y);
            y -= 3;
            y = drawCentered(cs, NORMAL, 9f, "Generado: " + OffsetDateTime.now().format(FMT), y);
            y -= 10;
            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 12;

            // ── Datos del viaje ───────────────────────────────────────────────
            String origen  = rutaRow != null ? String.valueOf(rutaRow[0]) : "—";
            String destino = rutaRow != null ? String.valueOf(rutaRow[1]) : "—";
            String placa   = vehRow  != null ? String.valueOf(vehRow[0])  : "—";
            String tipo    = vehRow  != null ? String.valueOf(vehRow[1])  : "—";

            y = drawKV(cs, BOLD, NORMAL, "Ruta:",      origen + " -> " + destino, y);
            y -= 2;
            y = drawKV(cs, BOLD, NORMAL, "Salida:",    viaje.getFechaHoraSal() != null ? viaje.getFechaHoraSal().format(FMT) : "—", y);
            y -= 2;
            if (viaje.getFechaHoraArr() != null)
                y = drawKV(cs, BOLD, NORMAL, "Llegada:", viaje.getFechaHoraArr().format(FMT), y);
            y -= 2;
            y = drawKV(cs, BOLD, NORMAL, "Vehículo:",  tipo + " — " + placa, y);
            y -= 2;
            y = drawKV(cs, BOLD, NORMAL, "Conductor:", conductorNombre, y);
            y -= 2;
            y = drawKV(cs, BOLD, NORMAL, "Estado:",    viaje.getEstado(), y);
            y -= 10;
            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 14;

            // ── Tabla pasajeros ───────────────────────────────────────────────
            y = drawSeccionTitulo(cs, BOLD, "PASAJEROS (" + pasajes.size() + ")", y);
            y -= 6;

            // Cabecera tabla
            float[] colsPas = { MARGIN, MARGIN + 80f, MARGIN + 230f, MARGIN + 270f, MARGIN + 320f, MARGIN + 380f };
            String[] headPas = { "Boleta", "Pasajero / DNI", "Asiento", "Total", "Pago", "Estado" };
            drawTableHeader(cs, BOLD, MONO, colsPas, headPas, y);
            y -= 16;
            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 4;

            for (Object[] p : pasajes) {
                if (y < MARGIN + 60) {
                    cs.close(); pageNum++;
                    page = new PDPage(PDRectangle.A4); doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);
                    y = PAGE_H - MARGIN;
                    drawTableHeader(cs, BOLD, MONO, colsPas, headPas, y);
                    y -= 16; drawLine(cs, MARGIN, PAGE_W - MARGIN, y); y -= 4;
                }
                cs.beginText();
                cs.setFont(MONO, 8f);
                cs.newLineAtOffset(colsPas[0], y);
                cs.showText(safe(p[0]));
                cs.endText();

                // Pasajero + DNI (two lines)
                cs.beginText();
                cs.setFont(NORMAL, 8f);
                cs.newLineAtOffset(colsPas[1], y + 4);
                String pasNombre = safe(p[1]);
                cs.showText(pasNombre.length() > 28 ? pasNombre.substring(0, 27) + "…" : pasNombre);
                cs.endText();
                cs.beginText();
                cs.setFont(NORMAL, 7f);
                cs.newLineAtOffset(colsPas[1], y - 4);
                cs.showText("DNI " + safe(p[2]));
                cs.endText();

                cs.beginText(); cs.setFont(BOLD, 9f);
                cs.newLineAtOffset(colsPas[2], y);
                cs.showText(String.valueOf(p[3] != null ? p[3] : "—")); cs.endText();

                cs.beginText(); cs.setFont(BOLD, 9f);
                cs.newLineAtOffset(colsPas[3], y);
                cs.showText(p[4] != null ? "S/ " + new BigDecimal(p[4].toString()).setScale(2, java.math.RoundingMode.HALF_UP).toPlainString() : "—");
                cs.endText();

                cs.beginText(); cs.setFont(NORMAL, 8f);
                cs.newLineAtOffset(colsPas[4], y);
                cs.showText(safe(p[6])); cs.endText();

                cs.beginText(); cs.setFont(NORMAL, 8f);
                cs.newLineAtOffset(colsPas[5], y);
                cs.showText(safe(p[5])); cs.endText();

                y -= 18;
            }

            y -= 4;
            drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
            y -= 11;
            cs.beginText(); cs.setFont(BOLD, 9f);
            cs.newLineAtOffset(PAGE_W - MARGIN - 200f, y);
            cs.showText("Total pasajes: S/ " + totalPasajes.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString());
            cs.endText();
            y -= 16;

            // ── Tabla encomiendas ─────────────────────────────────────────────
            if (!encomiendas.isEmpty()) {
                drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
                y -= 14;
                y = drawSeccionTitulo(cs, BOLD, "ENCOMIENDAS (" + encomiendas.size() + ")", y);
                y -= 6;

                float[] colsEnc = { MARGIN, MARGIN + 90f, MARGIN + 230f, MARGIN + 320f, MARGIN + 370f };
                String[] headEnc = { "Código", "Descripción", "Destino", "Precio", "Cobro" };
                drawTableHeader(cs, BOLD, MONO, colsEnc, headEnc, y);
                y -= 16; drawLine(cs, MARGIN, PAGE_W - MARGIN, y); y -= 4;

                for (Object[] e : encomiendas) {
                    if (y < MARGIN + 60) {
                        cs.close(); pageNum++;
                        page = new PDPage(PDRectangle.A4); doc.addPage(page);
                        cs = new PDPageContentStream(doc, page);
                        y = PAGE_H - MARGIN;
                        drawTableHeader(cs, BOLD, MONO, colsEnc, headEnc, y);
                        y -= 16; drawLine(cs, MARGIN, PAGE_W - MARGIN, y); y -= 4;
                    }
                    cs.beginText(); cs.setFont(MONO, 8f);
                    cs.newLineAtOffset(colsEnc[0], y);
                    cs.showText(safe(e[0])); cs.endText();

                    String desc = safe(e[1]);
                    cs.beginText(); cs.setFont(NORMAL, 8f);
                    cs.newLineAtOffset(colsEnc[1], y);
                    cs.showText(desc.length() > 22 ? desc.substring(0, 21) + "…" : desc); cs.endText();

                    String dest = safe(e[2]);
                    cs.beginText(); cs.setFont(NORMAL, 8f);
                    cs.newLineAtOffset(colsEnc[2], y);
                    cs.showText(dest.length() > 18 ? dest.substring(0, 17) + "…" : dest); cs.endText();

                    cs.beginText(); cs.setFont(BOLD, 9f);
                    cs.newLineAtOffset(colsEnc[3], y);
                    cs.showText(e[3] != null ? "S/ " + new BigDecimal(e[3].toString()).setScale(2, java.math.RoundingMode.HALF_UP).toPlainString() : "—");
                    cs.endText();

                    cs.beginText(); cs.setFont(NORMAL, 8f);
                    cs.newLineAtOffset(colsEnc[4], y);
                    cs.showText(safe(e[4])); cs.endText();

                    y -= 16;
                }
                y -= 4;
                drawLine(cs, MARGIN, PAGE_W - MARGIN, y);
                y -= 11;
                cs.beginText(); cs.setFont(BOLD, 9f);
                cs.newLineAtOffset(PAGE_W - MARGIN - 200f, y);
                cs.showText("Total encomiendas: S/ " + totalEncomiendas.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString());
                cs.endText();
                y -= 16;
            }

            // ── Resumen final ─────────────────────────────────────────────────
            if (y < MARGIN + 80) {
                cs.close(); pageNum++;
                page = new PDPage(PDRectangle.A4); doc.addPage(page);
                cs = new PDPageContentStream(doc, page);
                y = PAGE_H - MARGIN;
            }
            drawLine(cs, MARGIN, PAGE_W - MARGIN, y); y -= 14;
            y = drawCentered(cs, BOLD, 11f, "RESUMEN TOTAL", y); y -= 10;

            BigDecimal totalGeneral = totalPasajes.add(totalEncomiendas);
            y = drawKV(cs, BOLD, NORMAL, "Ingresos por pasajes:",    "S/ " + totalPasajes.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString(), y);      y -= 3;
            y = drawKV(cs, BOLD, NORMAL, "Ingresos por encomiendas:", "S/ " + totalEncomiendas.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString(), y); y -= 3;
            drawLine(cs, PAGE_W / 2f, PAGE_W - MARGIN, y); y -= 10;
            y = drawKV(cs, BOLD, BOLD, "TOTAL GENERAL:", "S/ " + totalGeneral.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString(), y);

            y -= 30;
            drawLine(cs, MARGIN, MARGIN + 160f, y);
            cs.beginText(); cs.setFont(NORMAL, 8f);
            cs.newLineAtOffset(MARGIN, y - 11);
            cs.showText("Firma responsable"); cs.endText();

            cs.close();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            log.error("Error generando liquidación viaje {}: {}", viajeId, e.getMessage(), e);
            throw new RuntimeException("Error generando PDF de liquidación", e);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private float drawCentered(PDPageContentStream cs, PDType1Font font, float size, String text, float y) throws IOException {
        float w = font.getStringWidth(text) / 1000f * size;
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset((PAGE_W - w) / 2f, y);
        cs.showText(text);
        cs.endText();
        return y - size - 2f;
    }

    private float drawKV(PDPageContentStream cs, PDType1Font keyFont, PDType1Font valFont, String key, String val, float y) throws IOException {
        cs.beginText(); cs.setFont(keyFont, 9f);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText(key); cs.endText();

        cs.beginText(); cs.setFont(valFont, 9f);
        cs.newLineAtOffset(MARGIN + 165f, y);
        cs.showText(val); cs.endText();
        return y - 13f;
    }

    private float drawSeccionTitulo(PDPageContentStream cs, PDType1Font bold, String titulo, float y) throws IOException {
        cs.beginText(); cs.setFont(bold, 10f);
        cs.newLineAtOffset(MARGIN, y);
        cs.showText(titulo); cs.endText();
        return y - 14f;
    }

    private void drawTableHeader(PDPageContentStream cs, PDType1Font bold, PDType1Font mono,
                                  float[] cols, String[] heads, float y) throws IOException {
        for (int i = 0; i < heads.length; i++) {
            cs.beginText(); cs.setFont(bold, 8f);
            cs.newLineAtOffset(cols[i], y);
            cs.showText(heads[i]); cs.endText();
        }
    }

    private void drawLine(PDPageContentStream cs, float x1, float x2, float y) throws IOException {
        cs.moveTo(x1, y); cs.lineTo(x2, y); cs.stroke();
    }

    private String safe(Object o) {
        if (o == null) return "—";
        String s = o.toString().trim();
        return s.isEmpty() ? "—" : s;
    }
}
