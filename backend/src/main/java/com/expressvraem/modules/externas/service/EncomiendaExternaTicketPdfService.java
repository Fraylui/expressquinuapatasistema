package com.expressvraem.modules.externas.service;

import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import com.expressvraem.modules.empresa.service.EmpresaConfigService;
import com.expressvraem.modules.externas.entity.EncomiendaExterna;
import com.expressvraem.shared.utils.PdfUtils;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class EncomiendaExternaTicketPdfService {

    private final EmpresaConfigService empresaConfigService;

    @Value("${app.control.url:https://expressvraem.pe/control/}")
    private String controlUrl;

    private static final float PAGE_W = 226.77f; // 80 mm
    private static final float MARGIN = 10f;

    public byte[] generarTicket(EncomiendaExterna enc, String operadorNombre) {
        EmpresaConfig emp = empresaConfigService.get();
        String EMPRESA = emp.getNombre() != null ? emp.getNombre() : "Mi Empresa";
        String RUC     = emp.getRuc()    != null && !emp.getRuc().isEmpty() ? "RUC: " + emp.getRuc() : "";
        String DIR     = emp.getDireccion() != null ? emp.getDireccion() : "";
        String CIUDAD  = emp.getCiudad()    != null ? emp.getCiudad()    : "";
        try (PDDocument doc = new PDDocument()) {

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
            String fechaStr = enc.getFechaRecepcion() != null ? enc.getFechaRecepcion().format(dtf) : "—";

            boolean cobrarAlDestinatario = "PENDIENTE".equals(enc.getEstadoPago());
            String  qrContent = controlUrl + enc.getCorrelativo();
            String  montoStr  = "S/ " + enc.getMonto().toPlainString();

            String hash = PdfUtils.sha256Short(
                    enc.getCorrelativo(),
                    enc.getMonto().toPlainString(),
                    enc.getConductorDni() != null ? enc.getConductorDni() : "",
                    fechaStr);

            float pageH = MARGIN + 20
                    + 40             // header empresa
                    + 6              // sep
                    + 72 + 10        // QR + nota
                    + 6              // sep
                    + 22 + 16        // titulo + correlativo
                    + 6              // sep
                    + 8 * 4 + 6      // conductor
                    + 8 * 3 + 6      // destinatario
                    + 8 * 2 + 6      // descripción
                    + 8 * 3 + 6      // cobro + operador
                    + 8 * 5 + 6      // control interno
                    + 20;
            pageH = Math.max(pageH, 320f); // mínimo ~113mm — suficiente para contenido básico

            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                // ── Encabezado empresa ─────────────────────────────────────────
                y = drawCentered(cs, fontBold, 9f, EMPRESA, y);  y -= 2;
                y = drawCentered(cs, fontNorm, 7f, RUC, y);      y -= 1;
                y = drawCentered(cs, fontNorm, 6f, DIR, y);      y -= 1;
                y = drawCentered(cs, fontNorm, 6f, CIUDAD, y);   y -= 4;
                y = drawDashes(cs, y);                            y -= 3;

                // ── QR de verificación ─────────────────────────────────────────
                PDImageXObject qrImg = buildQrImage(doc, qrContent);
                float qrSize = 68f;
                cs.drawImage(qrImg, (PAGE_W - qrSize) / 2f, y - qrSize, qrSize, qrSize);
                y -= (qrSize + 3);
                y = drawCentered(cs, fontNorm, 5.5f, "Escanea para verificar este ticket", y); y -= 2;
                y = drawDashes(cs, y); y -= 3;

                // ── Título del ticket ──────────────────────────────────────────
                y = drawCentered(cs, fontBold, 9f,  "TICKET DE CONTROL INTERNO", y);  y -= 2;
                y = drawCentered(cs, fontBold, 11f, enc.getCorrelativo(), y);          y -= 2;
                y = drawCentered(cs, fontNorm, 7f,  "Fecha: " + fechaStr, y);         y -= 4;
                y = drawDashes(cs, y);                                                  y -= 3;

                // ── Conductor externo ──────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "CONDUCTOR:", enc.getConductorNombre(), y);   y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DNI cond.:", enc.getConductorDni(), y);      y -= 1;
                if (enc.getConductorTel() != null && !enc.getConductorTel().isBlank()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. cond.:", enc.getConductorTel(), y); y -= 1;
                }
                if (enc.getConductorPlaca() != null && !enc.getConductorPlaca().isBlank()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Placa:", enc.getConductorPlaca().toUpperCase(), y); y -= 1;
                }
                y -= 2;

                // ── Destinatario ───────────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DESTINATARIO:", enc.getDestinatarioNombre(), y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DNI dest.:", enc.getDestinatarioDni(), y);       y -= 1;
                if (enc.getDestinatarioTel() != null && !enc.getDestinatarioTel().isBlank()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. dest.:", enc.getDestinatarioTel(), y);  y -= 1;
                }
                y -= 2;

                // ── Descripción ────────────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Descripcion:", enc.getDescripcion(), y); y -= 1;
                if (enc.getObservaciones() != null && !enc.getObservaciones().isBlank()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Obs.:", enc.getObservaciones(), y); y -= 1;
                }
                y -= 2;

                // ── Cobro ──────────────────────────────────────────────────────
                if (cobrarAlDestinatario) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr + " (A COBRAR)", y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Cobro:", "POR COBRAR AL DESTINATARIO", y);
                } else {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr, y);               y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Cobro:", "PAGADO — "
                            + (enc.getFormaPago() != null ? enc.getFormaPago() : ""), y);
                }
                y -= 2;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Operador:", ascii(operadorNombre), y); y -= 3;

                // ── CONTROL INTERNO ────────────────────────────────────────────
                y = drawDashes(cs, y); y -= 2;
                y = drawCentered(cs, fontBold, 7f, "[ CONTROL INTERNO ]", y); y -= 3;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Correlativo:", enc.getCorrelativo(), y);     y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Estado pago:",
                        cobrarAlDestinatario ? "PENDIENTE" : "PAGADO", y);                                y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Verificacion:", qrContent, y);               y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Hash:", hash, y);                             y -= 3;
                y = drawDashes(cs, y); y -= 3;

                // ── Footer ─────────────────────────────────────────────────────
                y = drawCentered(cs, fontObliq, 6.5f, "Conserve este ticket para reclamar.", y);   y -= 1;
                drawCentered(cs, fontNorm, 6f, "Uso interno — " + ascii(EMPRESA), y);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generando ticket PDF: " + e.getMessage(), e);
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private float drawCentered(PDPageContentStream cs, PDType1Font font, float size,
                                String text, float y) throws Exception {
        String s = ascii(text);
        float tw = font.getStringWidth(s) / 1000f * size;
        cs.beginText(); cs.setFont(font, size);
        cs.newLineAtOffset((PAGE_W - tw) / 2f, y - size); cs.showText(s); cs.endText();
        return y - size - 1;
    }

    private float drawLabel(PDPageContentStream cs, PDType1Font fontB, PDType1Font fontN,
                            float size, String label, String value, float y) throws Exception {
        String sl = ascii(label) + " ";
        cs.beginText(); cs.setFont(fontB, size);
        cs.newLineAtOffset(MARGIN, y - size); cs.showText(sl); cs.endText();
        float lw  = fontB.getStringWidth(sl) / 1000f * size;
        float vx  = MARGIN + lw;
        float maxW = PAGE_W - MARGIN - vx;
        String sv  = ascii(value != null ? value : "-");
        float vw   = fontN.getStringWidth(sv) / 1000f * size;
        if (vw > maxW && sv.length() > 22) sv = sv.substring(0, Math.min(sv.length(), 28)) + "...";
        cs.beginText(); cs.setFont(fontN, size);
        cs.newLineAtOffset(vx, y - size); cs.showText(sv); cs.endText();
        return y - size - 1;
    }

    private float drawDashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y); cs.lineTo(PAGE_W - MARGIN, y); cs.stroke();
        return y - 3;
    }

    // Métodos delegados a PdfUtils (DRY)
    private PDImageXObject buildQrImage(PDDocument doc, String text) throws Exception {
        return PdfUtils.buildQrImage(doc, text, 200);
    }

    private String ascii(String s) {
        return PdfUtils.ascii(s);
    }
}
