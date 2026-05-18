package com.expressvraem.modules.encomiendas.service;

import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class ComprobanteEntregaPdfService {

    private final ClienteRepository clienteRepository;
    private final EntityManager entityManager;

    private static final float PAGE_W = 226.77f;
    private static final float MARGIN  = 10f;
    private static final String EMPRESA = "EXPRESS QUINUAPATA VRAEM S.A.C.";

    public byte[] generarComprobanteEntrega(Encomienda enc, String operadorNombre) {
        try (PDDocument doc = new PDDocument()) {

            Cliente rem = clienteRepository.findById(enc.getRemitenteId()).orElse(null);
            Cliente des = clienteRepository.findById(enc.getDestinatarioId()).orElse(null);

            String remNombre = rem != null ? nombreDisplay(rem) : "—";
            String desNombre = des != null ? nombreDisplay(des) : "—";
            String desTel    = des != null && des.getTelefono() != null ? des.getTelefono() : "";

            String agenciaDestNombre = "—";
            if (enc.getAgenciaDestinoId() != null) {
                try {
                    Object[] ag = (Object[]) entityManager
                            .createNativeQuery("SELECT nombre, ciudad FROM agencias WHERE id = :id")
                            .setParameter("id", enc.getAgenciaDestinoId())
                            .getSingleResult();
                    agenciaDestNombre = ag[0] != null ? String.valueOf(ag[0]) : "—";
                } catch (Exception ignored) {}
            }

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
            String fechaEntrega = enc.getFechaEntregaReal() != null
                    ? enc.getFechaEntregaReal().format(dtf) : "—";

            boolean esPorCobrar = "POR_COBRAR".equals(enc.getFormaCobro());

            float pageH = 500f;
            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                // Header
                y = drawCenteredText(cs, fontBold, 9f, EMPRESA, y);                y -= 2;
                y = drawCenteredText(cs, fontNorm, 7f, "RUC: 20601234567", y);     y -= 4;
                y = drawDashes(cs, y);                                              y -= 3;

                // Title
                y = drawCenteredText(cs, fontBold, 9f, "COMPROBANTE DE ENTREGA", y); y -= 2;
                y = drawCenteredText(cs, fontBold, 12f, enc.getCodigoTracking(), y); y -= 6;
                y = drawDashes(cs, y);                                               y -= 3;

                // Entregado a
                y = drawCenteredText(cs, fontBold, 8f, "ENTREGADO A", y);           y -= 3;
                y = drawLabel(cs, fontBold, fontNorm, 7.5f, "Nombre:", enc.getRecibidoPorNombre(), y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7.5f, "DNI:",    enc.getRecibidoPorDni(), y);    y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7.5f, "Fecha:",  fechaEntrega, y);               y -= 3;
                y = drawDashes(cs, y);                                               y -= 3;

                // Paquete
                y = drawCenteredText(cs, fontBold, 7.5f, "DATOS DEL PAQUETE", y);  y -= 3;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Remitente:",   remNombre, y);   y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Destinatario:",desNombre, y);   y -= 1;
                if (!desTel.isEmpty()) { y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. dest.:", desTel, y); y -= 1; }
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Contenido:",   enc.getDescripcion(), y); y -= 1;
                if (enc.getPesoKg() != null) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Peso:", enc.getPesoKg() + " kg", y); y -= 1;
                }
                int bultos = enc.getNumBultos() != null ? enc.getNumBultos() : 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Bultos:", String.valueOf(bultos), y); y -= 3;
                y = drawDashes(cs, y);                                               y -= 3;

                // Cobro
                if (esPorCobrar) {
                    String montoStr = enc.getMonto() != null
                            ? "S/ " + enc.getMonto().toPlainString()
                            : "S/ " + enc.getPrecioEnvio().toPlainString();
                    y = drawCenteredText(cs, fontBold, 8f, "COBRADO EN DESTINO", y); y -= 2;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto cobrado:", montoStr, y);      y -= 1;
                    y = drawDashes(cs, y);                                           y -= 3;
                }

                // Operador y agencia
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Operador:", operadorNombre, y);         y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Agencia:",  agenciaDestNombre, y);      y -= 3;
                y = drawDashes(cs, y);                                               y -= 3;

                // Footer
                y = drawCenteredText(cs, fontObliq, 6.5f, "Gracias por usar Express Quinuapata VRAEM S.A.C.", y); y -= 1;
                drawCenteredText(cs, fontNorm, 6f, "expressvraem.pe", y);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generando comprobante de entrega: " + e.getMessage(), e);
        }
    }

    private String nombreDisplay(Cliente c) {
        if ("EMPRESA".equals(c.getTipo()) && c.getRazonSocial() != null) return c.getRazonSocial();
        return c.getApellidos() + ", " + c.getNombres();
    }

    private float drawCenteredText(PDPageContentStream cs, PDType1Font font, float size,
                                   String text, float y) throws Exception {
        String safe = ascii(text);
        float tw = font.getStringWidth(safe) / 1000f * size;
        float x  = (PAGE_W - tw) / 2f;
        cs.beginText(); cs.setFont(font, size);
        cs.newLineAtOffset(x, y - size); cs.showText(safe); cs.endText();
        return y - size - 1;
    }

    private String ascii(String s) {
        if (s == null) return "";
        return s.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')
                .replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U')
                .replace('ñ','n').replace('Ñ','N').replace('ü','u').replace('Ü','U')
                .replace('→','>').replace('—','-').replace('–','-').replace('…','.')
                .replace('¡','!').replace('¿','?').replaceAll("[^\\x00-\\x7E]", "?");
    }

    private float drawLabel(PDPageContentStream cs, PDType1Font fontB, PDType1Font fontN,
                            float size, String label, String value, float y) throws Exception {
        String safeLabel = ascii(label) + " ";
        cs.beginText(); cs.setFont(fontB, size);
        cs.newLineAtOffset(MARGIN, y - size); cs.showText(safeLabel); cs.endText();
        float labelW = fontB.getStringWidth(safeLabel) / 1000f * size;
        String display = ascii(value != null ? value : "-");
        if (display.length() > 30) display = display.substring(0, 28) + "...";
        cs.beginText(); cs.setFont(fontN, size);
        cs.newLineAtOffset(MARGIN + labelW, y - size); cs.showText(display); cs.endText();
        return y - size - 1;
    }

    private float drawDashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y); cs.lineTo(PAGE_W - MARGIN, y); cs.stroke();
        return y - 3;
    }
}
