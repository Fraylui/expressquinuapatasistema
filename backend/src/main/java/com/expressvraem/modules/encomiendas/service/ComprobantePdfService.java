package com.expressvraem.modules.encomiendas.service;

import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.repository.ClienteRepository;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ComprobantePdfService {

    private final ClienteRepository clienteRepository;
    private final EntityManager entityManager;

    private static final float PAGE_W   = 226.77f; // 80mm in points
    private static final float MARGIN   = 10f;
    private static final String EMPRESA = "EXPRESS QUINUAPATA VRAEM S.A.C.";
    private static final String RUC     = "RUC: 20601234567";
    private static final String DIR     = "Jr. Lima 245, Mercado Andres F. Vivanco";
    private static final String CIUDAD  = "Huamanga - Ayacucho  Telf: 066-312456";
    private static final String TRACK_URL = "expressvraem.pe/tracking/";

    public byte[] generarComprobante(Encomienda enc, String operadorNombre) {
        try (PDDocument doc = new PDDocument()) {

            // --- gather client data ---
            Cliente rem = clienteRepository.findById(enc.getRemitenteId()).orElse(null);
            Cliente des = clienteRepository.findById(enc.getDestinatarioId()).orElse(null);

            String remNombre = rem != null ? nombreDisplay(rem) : "—";
            String remDoc    = rem != null ? rem.getTipoDoc() + " " + rem.getNumDoc() : "";
            String remTel    = rem != null && rem.getTelefono() != null ? rem.getTelefono() : "";
            String desNombre = des != null ? nombreDisplay(des) : "—";
            String desTel    = des != null && des.getTelefono() != null ? des.getTelefono() : "";

            // --- agencia destino ---
            String agenciaDestNombre = "—";
            String agenciaDestCiudad = "";
            if (enc.getAgenciaDestinoId() != null) {
                try {
                    Object[] ag = (Object[]) entityManager
                        .createNativeQuery("SELECT nombre, ciudad FROM agencias WHERE id = :id")
                        .setParameter("id", enc.getAgenciaDestinoId())
                        .getSingleResult();
                    agenciaDestNombre = ag[0] != null ? String.valueOf(ag[0]) : "—";
                    agenciaDestCiudad = ag[1] != null ? String.valueOf(ag[1]) : "";
                } catch (Exception ignored) {}
            }

            // --- viaje info ---
            String viajeHora  = "";
            String viajePlaca = "";
            String viajeRuta  = "";
            if (enc.getViajeId() != null) {
                try {
                    Object[] vRow = (Object[]) entityManager.createNativeQuery(
                        "SELECT v.fecha_hora_sal, ve.placa, r.origen, r.destino " +
                        "FROM viajes v " +
                        "JOIN vehiculos ve ON ve.id = v.vehiculo_id " +
                        "JOIN rutas r ON r.id = v.ruta_id " +
                        "WHERE v.id = :id")
                        .setParameter("id", enc.getViajeId())
                        .getSingleResult();
                    if (vRow[0] != null) {
                        DateTimeFormatter hFmt = DateTimeFormatter.ofPattern("HH:mm dd/MM");
                        if (vRow[0] instanceof java.sql.Timestamp ts)
                            viajeHora = ts.toLocalDateTime().format(hFmt);
                        else if (vRow[0] instanceof java.time.OffsetDateTime odt)
                            viajeHora = odt.format(hFmt);
                    }
                    viajePlaca = vRow[1] != null ? String.valueOf(vRow[1]) : "";
                    viajeRuta  = ascii(vRow[2] != null ? String.valueOf(vRow[2]) : "")
                               + " > "
                               + ascii(vRow[3] != null ? String.valueOf(vRow[3]) : "");
                } catch (Exception ignored) {}
            }

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
            String fechaStr = enc.getFechaRegistro() != null
                    ? enc.getFechaRegistro().format(dtf) : "—";

            boolean esPorCobrar = "POR_COBRAR".equals(enc.getFormaCobro());

            // --- compute page height ---
            float yEst = MARGIN + 20;
            yEst += 10 + 8 + 8 + 8;      // header
            yEst += 6;                     // sep
            yEst += 12 + 14;              // titulo + codigo
            yEst += 72;                   // QR
            yEst += 6;                    // sep
            yEst += 8 * 16;              // data rows
            if (!viajeHora.isEmpty()) yEst += 8 * 3;
            yEst += 6;                    // sep
            yEst += 20;                   // footer

            float pageH = Math.max(yEst, 420f);
            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                // ── Company header ──────────────────────────────────────
                y = drawCenteredText(cs, fontBold, 9f, EMPRESA, y);       y -= 2;
                y = drawCenteredText(cs, fontNorm, 7f, RUC, y);           y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, DIR, y);           y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, CIUDAD, y);        y -= 4;
                y = drawDashes(cs, y);                                     y -= 3;

                // ── Título + Tracking ───────────────────────────────────
                y = drawCenteredText(cs, fontBold, 8f, "COMPROBANTE DE ENCOMIENDA", y); y -= 2;
                y = drawCenteredText(cs, fontBold, 11f, enc.getCodigoTracking(), y);    y -= 4;

                // ── QR (tracking URL encoded) ───────────────────────────
                String qrContent = TRACK_URL + enc.getCodigoTracking();
                PDImageXObject qrImg = buildQrImage(doc, qrContent);
                float qrSize = 72f;
                cs.drawImage(qrImg, (PAGE_W - qrSize) / 2f, y - qrSize, qrSize, qrSize);
                y -= (qrSize + 4);

                // ── Destino resaltado ───────────────────────────────────
                y = drawCenteredText(cs, fontBold, 8f, "DESTINO: " + agenciaDestCiudad.toUpperCase(), y);
                y -= 3;
                y = drawDashes(cs, y);                                     y -= 3;

                // ── Remitente ───────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "REMITENTE:", remNombre, y);   y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Documento:", remDoc, y);
                if (!remTel.isEmpty()) { y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. rem.:", remTel, y); }
                y -= 3;

                // ── Destinatario ────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DESTINATARIO:", desNombre, y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Agencia dest.:", agenciaDestNombre, y);
                if (!desTel.isEmpty()) { y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. dest.:", desTel, y); }
                y -= 3;

                // ── Contenido ───────────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Contenido:", enc.getDescripcion(), y);
                if (enc.getPesoKg() != null) { y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Peso:", enc.getPesoKg() + " kg", y); }
                int bultos = enc.getNumBultos() != null ? enc.getNumBultos() : 1;
                y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Bultos:", String.valueOf(bultos), y);
                y -= 3;

                // ── Viaje asignado ──────────────────────────────────────
                if (!viajeHora.isEmpty()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Viaje:", viajeRuta, y);         y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Hora salida:", viajeHora, y);   y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Vehiculo:", viajePlaca, y);     y -= 3;
                }

                // ── Cobro ───────────────────────────────────────────────
                String montoStr = enc.getMonto() != null
                        ? "S/ " + enc.getMonto().toPlainString() : "S/ " + enc.getPrecioEnvio().toPlainString();
                if (esPorCobrar) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr + " (EN DESTINO)", y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Cobro:", "POR COBRAR AL DESTINATARIO", y);
                } else {
                    String cobro = enc.getFormaCobro() != null ? enc.getFormaCobro() : "EFECTIVO";
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr, y);     y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Forma pago:", cobro, y);
                }
                y -= 3;

                // ── Fecha + Operador ────────────────────────────────────
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Fecha:", fechaStr, y);         y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Operador:", operadorNombre, y); y -= 3;

                // ── Separator ───────────────────────────────────────────
                y = drawDashes(cs, y);                                     y -= 3;

                // ── Footer ──────────────────────────────────────────────
                y = drawCenteredText(cs, fontObliq, 6.5f, "Conserve este comprobante.", y);               y -= 1;
                y = drawCenteredText(cs, fontObliq, 6.5f, "Rastreo: " + TRACK_URL + enc.getCodigoTracking(), y); y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, "Estado: " + enc.getEstado(), y);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Error generando comprobante PDF: " + e.getMessage(), e);
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private String nombreDisplay(Cliente c) {
        if ("EMPRESA".equals(c.getTipo()) && c.getRazonSocial() != null) return c.getRazonSocial();
        return c.getApellidos() + ", " + c.getNombres();
    }

    private float drawCenteredText(PDPageContentStream cs, PDType1Font font, float size,
                                   String text, float y) throws Exception {
        String safe = ascii(text);
        float tw = font.getStringWidth(safe) / 1000f * size;
        float x  = (PAGE_W - tw) / 2f;
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y - size);
        cs.showText(safe);
        cs.endText();
        return y - size - 1;
    }

    private float drawLabel(PDPageContentStream cs, PDType1Font fontB, PDType1Font fontN,
                            float size, String label, String value, float y) throws Exception {
        String safeLabel = ascii(label) + " ";
        cs.beginText();
        cs.setFont(fontB, size);
        cs.newLineAtOffset(MARGIN, y - size);
        cs.showText(safeLabel);
        cs.endText();

        float labelW = fontB.getStringWidth(safeLabel) / 1000f * size;
        float valueX = MARGIN + labelW;
        float maxW   = PAGE_W - MARGIN - valueX;

        String display = ascii(value != null ? value : "-");
        float valW = fontN.getStringWidth(display) / 1000f * size;
        if (valW > maxW && display.length() > 22) {
            display = display.substring(0, Math.min(display.length(), 28)) + "...";
        }

        cs.beginText();
        cs.setFont(fontN, size);
        cs.newLineAtOffset(valueX, y - size);
        cs.showText(display);
        cs.endText();
        return y - size - 1;
    }

    private float drawDashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y);
        cs.lineTo(PAGE_W - MARGIN, y);
        cs.stroke();
        return y - 3;
    }

    private String ascii(String s) {
        if (s == null) return "";
        return s.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')
                .replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U')
                .replace('ñ','n').replace('Ñ','N').replace('ü','u').replace('Ü','U')
                .replace('→','>').replace('—','-').replace('–','-').replace('…','.')
                .replace('¡','!').replace('¿','?').replaceAll("[^\\x00-\\x7E]", "?");
    }

    private PDImageXObject buildQrImage(PDDocument doc, String text) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 1);
        BitMatrix matrix = writer.encode(text, BarcodeFormat.QR_CODE, 200, 200, hints);
        BufferedImage img = MatrixToImageWriter.toBufferedImage(matrix);
        return LosslessFactory.createFromImage(doc, img);
    }
}
