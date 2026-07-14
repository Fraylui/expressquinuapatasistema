package com.expressvraem.modules.caja.service;

import com.expressvraem.modules.caja.entity.EntregaEfectivo;
import com.expressvraem.modules.empresa.entity.EmpresaConfig;
import com.expressvraem.modules.empresa.service.EmpresaConfigService;
import com.expressvraem.shared.utils.PdfUtils;
import jakarta.persistence.EntityManager;
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

/**
 * Comprobante de rendición de efectivo (80 mm): una copia viaja con el dinero,
 * otra queda en la agencia. Incluye QR y hash de control para verificar que el
 * documento no fue alterado.
 */
@Service
@RequiredArgsConstructor
public class EntregaEfectivoPdfService {

    private final EmpresaConfigService empresaConfigService;
    private final EntityManager entityManager;

    @Value("${app.control.url:https://sistema.expressquinuapata.com/control/}")
    private String controlUrl;

    private static final float PAGE_W = 226.77f; // 80 mm
    private static final float MARGIN = 10f;

    public byte[] generarComprobante(EntregaEfectivo entrega) {
        EmpresaConfig emp = empresaConfigService.get();
        String EMPRESA = emp.getNombre() != null ? emp.getNombre() : "Mi Empresa";
        String RUC     = emp.getRuc()    != null && !emp.getRuc().isEmpty() ? "RUC: " + emp.getRuc() : "";

        try (PDDocument doc = new PDDocument()) {

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
            String fechaStr = entrega.getFechaEntrega() != null
                    ? entrega.getFechaEntrega().format(dtf) : "—";

            String agenciaNombre = resolverAgencia(entrega.getAgenciaId());
            String entregaNombre = resolverUsuario(entrega.getUsuarioEntregaId());
            String confirmaNombre = entrega.getUsuarioConfirmaId() != null
                    ? resolverUsuario(entrega.getUsuarioConfirmaId()) : null;

            boolean esDeposito = "DEPOSITO_BANCARIO".equals(entrega.getModalidad());
            String montoStr   = "S/ " + entrega.getMontoDeclarado().toPlainString();
            String qrContent  = controlUrl + entrega.getNumero();
            String hash = PdfUtils.sha256Short(
                    entrega.getNumero(),
                    entrega.getMontoDeclarado().toPlainString(),
                    String.valueOf(entrega.getAgenciaId()),
                    fechaStr);

            boolean confirmada = entrega.getMontoConfirmado() != null;

            float pageH = 410f + (confirmada ? 50f : 0f);
            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                // ── Encabezado ─────────────────────────────────────────────────
                y = drawCentered(cs, fontBold, 9f, EMPRESA, y);  y -= 2;
                y = drawCentered(cs, fontNorm, 7f, RUC, y);      y -= 4;
                y = drawDashes(cs, y);                            y -= 3;

                // ── Título ─────────────────────────────────────────────────────
                y = drawCentered(cs, fontBold, 9f,  "RENDICION DE EFECTIVO", y);  y -= 2;
                y = drawCentered(cs, fontBold, 12f, entrega.getNumero(), y);       y -= 4;

                // ── QR de verificación ─────────────────────────────────────────
                PDImageXObject qrImg = PdfUtils.buildQrImage(doc, qrContent, 200);
                float qrSize = 64f;
                cs.drawImage(qrImg, (PAGE_W - qrSize) / 2f, y - qrSize, qrSize, qrSize);
                y -= (qrSize + 3);
                y = drawCentered(cs, fontNorm, 5.5f, "Escanea para verificar esta rendicion", y); y -= 2;
                y = drawDashes(cs, y); y -= 3;

                // ── Monto destacado ────────────────────────────────────────────
                y = drawCentered(cs, fontNorm, 7f, "MONTO ENTREGADO", y);  y -= 1;
                y = drawCentered(cs, fontBold, 14f, montoStr, y);          y -= 4;
                y = drawDashes(cs, y); y -= 3;

                // ── Datos de la entrega ────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Agencia:",   agenciaNombre, y);   y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Entrega:",   entregaNombre, y);   y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Fecha:",     fechaStr, y);        y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Modalidad:",
                        esDeposito ? "DEPOSITO BANCARIO" : "ENTREGA DIRECTA", y);            y -= 1;
                if (esDeposito && entrega.getNroOperacion() != null) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Nro. operacion:", entrega.getNroOperacion(), y); y -= 1;
                }
                if (entrega.getObservaciones() != null && !entrega.getObservaciones().isBlank()) {
                    y = drawWrappedLabel(cs, fontBold, fontNorm, 7f, "Obs.:", entrega.getObservaciones(), y); y -= 1;
                }
                y -= 2;
                y = drawDashes(cs, y); y -= 3;

                // ── Confirmación (si ya fue procesada) ─────────────────────────
                if (confirmada) {
                    y = drawCentered(cs, fontBold, 7.5f, "[ CONFIRMACION DE GERENCIA ]", y); y -= 2;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Recibido por:", confirmaNombre, y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto recibido:",
                            "S/ " + entrega.getMontoConfirmado().toPlainString(), y); y -= 1;
                    String difStr = entrega.getDiferencia() != null
                            ? entrega.getDiferencia().toPlainString() : "0";
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Diferencia:", "S/ " + difStr, y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Resultado:", entrega.getEstado(), y); y -= 2;
                    y = drawDashes(cs, y); y -= 3;
                } else {
                    // Espacio para firma del receptor en papel
                    y -= 18;
                    y = drawCentered(cs, fontNorm, 6.5f, "_______________________________", y); y -= 1;
                    y = drawCentered(cs, fontNorm, 6.5f, "Firma y DNI de quien recibe", y);      y -= 3;
                    y = drawDashes(cs, y); y -= 3;
                }

                // ── Control interno ────────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Estado:", entrega.getEstado(), y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Hash ctrl:", hash, y);              y -= 3;

                // ── Footer ─────────────────────────────────────────────────────
                y = drawCentered(cs, fontObliq, 6.5f, "Documento de control interno.", y); y -= 1;
                drawCentered(cs, fontNorm, 6f, "Conserve una copia en agencia.", y);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generando comprobante de rendicion: " + e.getMessage(), e);
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private String resolverAgencia(Long id) {
        try {
            Object[] r = (Object[]) entityManager
                    .createNativeQuery("SELECT nombre, ciudad FROM agencias WHERE id = :id")
                    .setParameter("id", id).getSingleResult();
            return r[0] + " - " + r[1];
        } catch (Exception e) { return "—"; }
    }

    private String resolverUsuario(Long id) {
        try {
            Object[] r = (Object[]) entityManager
                    .createNativeQuery("SELECT nombres, apellidos FROM usuarios WHERE id = :id")
                    .setParameter("id", id).getSingleResult();
            return r[0] + " " + r[1];
        } catch (Exception e) { return "—"; }
    }

    private float drawCentered(PDPageContentStream cs, PDType1Font font, float size,
                               String text, float y) throws Exception {
        String s = PdfUtils.ascii(text);
        float tw = font.getStringWidth(s) / 1000f * size;
        cs.beginText(); cs.setFont(font, size);
        cs.newLineAtOffset((PAGE_W - tw) / 2f, y - size); cs.showText(s); cs.endText();
        return y - size - 1;
    }

    private float drawLabel(PDPageContentStream cs, PDType1Font fontB, PDType1Font fontN,
                            float size, String label, String value, float y) throws Exception {
        String sl = PdfUtils.ascii(label) + " ";
        cs.beginText(); cs.setFont(fontB, size);
        cs.newLineAtOffset(MARGIN, y - size); cs.showText(sl); cs.endText();
        float lw = fontB.getStringWidth(sl) / 1000f * size;
        String sv = PdfUtils.ascii(value != null ? value : "-");
        float maxW = PAGE_W - MARGIN * 2 - lw;
        if (fontN.getStringWidth(sv) / 1000f * size > maxW && sv.length() > 22)
            sv = sv.substring(0, Math.min(sv.length(), 28)) + "...";
        cs.beginText(); cs.setFont(fontN, size);
        cs.newLineAtOffset(MARGIN + lw, y - size); cs.showText(sv); cs.endText();
        return y - size - 1;
    }

    /** Como drawLabel pero el valor se imprime completo, envuelto en varias líneas. */
    private float drawWrappedLabel(PDPageContentStream cs, PDType1Font fontB, PDType1Font fontN,
                                   float size, String label, String value, float y) throws Exception {
        String sl = PdfUtils.ascii(label) + " ";
        float lw = fontB.getStringWidth(sl) / 1000f * size;
        float maxW = PAGE_W - MARGIN * 2 - lw;
        cs.beginText(); cs.setFont(fontB, size);
        cs.newLineAtOffset(MARGIN, y - size); cs.showText(sl); cs.endText();
        for (String line : PdfUtils.wrapText(fontN, size, value, maxW)) {
            cs.beginText(); cs.setFont(fontN, size);
            cs.newLineAtOffset(MARGIN + lw, y - size); cs.showText(line); cs.endText();
            y = y - size - 1;
        }
        return y;
    }

    private float drawDashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y); cs.lineTo(PAGE_W - MARGIN, y); cs.stroke();
        return y - 3;
    }
}
