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
import org.springframework.transaction.annotation.Transactional;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.format.DateTimeFormatter;
import java.util.EnumMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ComprobantePdfService {

    private final ClienteRepository clienteRepository;
    private final EntityManager entityManager;

    private static final float  PAGE_W    = 226.77f; // 80 mm
    private static final float  MARGIN    = 10f;
    private static final String EMPRESA   = "EXPRESS QUINUAPATA VRAEM S.A.C.";
    private static final String RUC       = "RUC: 20601234567";
    private static final String DIR       = "Jr. Lima 245, Mercado Andres F. Vivanco";
    private static final String CIUDAD    = "Huamanga - Ayacucho  Telf: 066-312456";
    private static final String TRACK_URL = "https://expressvraem.pe/tracking/";

    @Transactional(readOnly = true)
    public byte[] generarComprobante(Encomienda enc, String operadorNombre) {
        try (PDDocument doc = new PDDocument()) {

            Cliente rem = clienteRepository.findById(enc.getRemitenteId()).orElse(null);
            Cliente des = clienteRepository.findById(enc.getDestinatarioId()).orElse(null);

            String remNombre = rem != null ? nombreDisplay(rem) : "—";
            String remDoc    = rem != null ? rem.getTipoDoc() + " " + rem.getNumDoc() : "";
            String remTel    = rem != null && rem.getTelefono() != null ? rem.getTelefono() : "";
            String desNombre = des != null ? nombreDisplay(des) : "—";
            String desTel    = des != null && des.getTelefono() != null ? des.getTelefono() : "";

            String agenciaDestNombre = "—";
            String agenciaDestCiudad = "";
            if (enc.getAgenciaDestinoId() != null) {
                try {
                    Object[] ag = (Object[]) entityManager
                        .createNativeQuery("SELECT nombre, ciudad FROM agencias WHERE id = :id")
                        .setParameter("id", enc.getAgenciaDestinoId()).getSingleResult();
                    agenciaDestNombre = ag[0] != null ? String.valueOf(ag[0]) : "—";
                    agenciaDestCiudad = ag[1] != null ? String.valueOf(ag[1]) : "";
                } catch (Exception ignored) {}
            }

            String viajeHora = "", viajePlaca = "", viajeRuta = "";
            if (enc.getViajeId() != null) {
                try {
                    Object[] vRow = (Object[]) entityManager.createNativeQuery(
                        "SELECT v.fecha_hora_sal, ve.placa, r.origen, r.destino " +
                        "FROM viajes v JOIN vehiculos ve ON ve.id=v.vehiculo_id " +
                        "JOIN rutas r ON r.id=v.ruta_id WHERE v.id=:id")
                        .setParameter("id", enc.getViajeId()).getSingleResult();
                    if (vRow[0] != null) {
                        DateTimeFormatter hFmt = DateTimeFormatter.ofPattern("HH:mm dd/MM");
                        if (vRow[0] instanceof java.sql.Timestamp ts)
                            viajeHora = ts.toLocalDateTime().format(hFmt);
                        else if (vRow[0] instanceof java.time.OffsetDateTime odt)
                            viajeHora = odt.format(hFmt);
                    }
                    viajePlaca = vRow[1] != null ? String.valueOf(vRow[1]) : "";
                    viajeRuta  = ascii(vRow[2] != null ? String.valueOf(vRow[2]) : "")
                               + " > " + ascii(vRow[3] != null ? String.valueOf(vRow[3]) : "");
                } catch (Exception ignored) {}
            }

            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
            String fechaStr = enc.getFechaRegistro() != null ? enc.getFechaRegistro().format(dtf) : "—";

            boolean esPorCobrar = "POR_COBRAR".equals(enc.getFormaCobro());
            String qrContent    = TRACK_URL + enc.getCodigoTracking();
            String montoStr     = enc.getMonto() != null
                    ? "S/ " + enc.getMonto().toPlainString()
                    : enc.getPrecioEnvio() != null ? "S/ " + enc.getPrecioEnvio().toPlainString() : "—";

            String monto4hash   = enc.getMonto() != null
                    ? enc.getMonto().toPlainString()
                    : enc.getPrecioEnvio() != null ? enc.getPrecioEnvio().toPlainString() : "0";
            String hash = computeHash(enc.getCodigoTracking(), monto4hash, remDoc, fechaStr);

            // ── Estimar altura total ───────────────────────────────────────────
            // Sección CONTROL INTERNO (arriba): ~9 filas
            float ciH = 8 + 2              // header empresa compact
                      + 10 + 4            // tracking bold + gap
                      + 8 * 6             // 6 filas de datos
                      + 6;                // gap antes de corte
            // Línea de corte: ~12
            float cortH = 12f;
            // Sección COMPROBANTE (abajo): cabecera + QR + datos
            float cpH = 10 + 8 + 8 + 8    // header empresa
                      + 6                 // dash
                      + 12 + 14          // titulo + tracking
                      + 72 + 10          // QR + nota
                      + 6                // destino + dash
                      + 8 * 9            // rem + des + paquete
                      + (viajeHora.isEmpty() ? 0 : 8 * 3)
                      + 8 * 4            // cobro + emision
                      + 6                // dash
                      + 8 * 2            // footer
                      + MARGIN * 2;

            float pageH = Math.max(ciH + cortH + cpH, 520f);
            PDPage page = new PDPage(new PDRectangle(PAGE_W, pageH));
            doc.addPage(page);

            PDType1Font fontBold  = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font fontNorm  = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font fontObliq = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                float y = pageH - MARGIN;

                // ════════════════════════════════════════════════════════════════
                //  SECCIÓN 1: CONTROL INTERNO  (copia del operador)
                // ════════════════════════════════════════════════════════════════

                // Cabecera compacta
                y = drawCenteredText(cs, fontBold, 7f, EMPRESA, y); y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, RUC, y);     y -= 3;

                y = drawDashes(cs, y); y -= 2;

                y = drawCenteredText(cs, fontBold, 7.5f, "CONTROL INTERNO", y); y -= 2;

                // Tracking en grande
                y = drawCenteredText(cs, fontBold, 10f, enc.getCodigoTracking(), y); y -= 4;

                // Serie/correlativo
                if (enc.getSerie() != null && enc.getCorrelativo() != null) {
                    y = drawCenteredText(cs, fontNorm, 6.5f, enc.getSerie() + " - " + enc.getCorrelativo(), y); y -= 3;
                }

                // Datos de control
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Fecha:",       fechaStr, y);               y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Operador:",    operadorNombre, y);          y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Estado:",      enc.getEstado(), y);         y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Remitente:",   remNombre, y);               y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Doc rem.:",    remDoc, y);                  y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Destinatario:", desNombre, y);              y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Destino:",     agenciaDestNombre + (agenciaDestCiudad.isEmpty() ? "" : " - " + agenciaDestCiudad), y); y -= 1;
                if (!viajeHora.isEmpty()) {
                    y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Viaje:",   viajeRuta + "  " + viajeHora + "  " + viajePlaca, y); y -= 1;
                }
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Monto:",       montoStr + (esPorCobrar ? " (EN DESTINO)" : ""), y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 6.5f, "Forma pago:",  esPorCobrar ? "POR COBRAR" : (enc.getFormaCobro() != null ? enc.getFormaCobro() : "EFECTIVO"), y); y -= 2;
                y = drawLabel(cs, fontBold, fontNorm, 6f,   "Hash ctrl:",   hash, y); y -= 4;

                // ════════════════════════════════════════════════════════════════
                //  LÍNEA DE CORTE
                // ════════════════════════════════════════════════════════════════
                y = drawCutLine(cs, fontNorm, y); y -= 4;

                // ════════════════════════════════════════════════════════════════
                //  SECCIÓN 2: COMPROBANTE DE ENCOMIENDA (copia del cliente)
                // ════════════════════════════════════════════════════════════════

                // Encabezado completo
                y = drawCenteredText(cs, fontBold, 9f, EMPRESA, y);  y -= 2;
                y = drawCenteredText(cs, fontNorm, 7f, RUC, y);      y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, DIR, y);      y -= 1;
                y = drawCenteredText(cs, fontNorm, 6f, CIUDAD, y);   y -= 4;
                y = drawDashes(cs, y);                                y -= 3;

                // Título + tracking
                y = drawCenteredText(cs, fontBold, 8f, "COMPROBANTE DE ENCOMIENDA", y); y -= 2;
                y = drawCenteredText(cs, fontBold, 11f, enc.getCodigoTracking(), y);    y -= 4;

                // QR
                PDImageXObject qrImg = buildQrImage(doc, qrContent);
                float qrSize = 72f;
                cs.drawImage(qrImg, (PAGE_W - qrSize) / 2f, y - qrSize, qrSize, qrSize);
                y -= (qrSize + 3);
                y = drawCenteredText(cs, fontNorm, 5.5f, "Escanea para rastrear tu encomienda", y); y -= 2;

                // Destino
                y = drawCenteredText(cs, fontBold, 8f, "DESTINO: " + agenciaDestCiudad.toUpperCase(), y);
                y -= 3;
                y = drawDashes(cs, y); y -= 3;

                // Remitente
                y = drawLabel(cs, fontBold, fontNorm, 7f, "REMITENTE:", remNombre, y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Documento:", remDoc, y);
                if (!remTel.isEmpty()) { y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. rem.:", remTel, y); }
                y -= 3;

                // Destinatario
                y = drawLabel(cs, fontBold, fontNorm, 7f, "DESTINATARIO:", desNombre, y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Agencia dest.:", agenciaDestNombre, y);
                if (!desTel.isEmpty()) { y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Tel. dest.:", desTel, y); }
                y -= 3;

                // Paquete
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Contenido:", enc.getDescripcion(), y);
                if (enc.getPesoKg() != null) { y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Peso:", enc.getPesoKg() + " kg", y); }
                int bultos = enc.getNumBultos() != null ? enc.getNumBultos() : 1;
                y -= 1; y = drawLabel(cs, fontBold, fontNorm, 7f, "Bultos:", String.valueOf(bultos), y);
                y -= 3;

                // Viaje asignado
                if (!viajeHora.isEmpty()) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Viaje:", viajeRuta, y);       y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Hora salida:", viajeHora, y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Vehiculo:", viajePlaca, y);   y -= 3;
                }

                // Cobro
                if (esPorCobrar) {
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr + " (EN DESTINO)", y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Cobro:", "POR COBRAR AL DESTINATARIO", y);
                } else {
                    String cobro = enc.getFormaCobro() != null ? enc.getFormaCobro() : "EFECTIVO";
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Monto:", montoStr, y); y -= 1;
                    y = drawLabel(cs, fontBold, fontNorm, 7f, "Forma pago:", cobro, y);
                }
                y -= 3;

                // Emisión
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Fecha:", fechaStr, y); y -= 1;
                y = drawLabel(cs, fontBold, fontNorm, 7f, "Operador:", operadorNombre, y); y -= 3;

                y = drawDashes(cs, y); y -= 3;

                // Footer cliente
                y = drawCenteredText(cs, fontObliq, 6.5f, "Conserve este comprobante.", y); y -= 1;
                drawCenteredText(cs, fontNorm, 6f, "Estado: " + enc.getEstado(), y);
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
        cs.beginText(); cs.setFont(font, size);
        cs.newLineAtOffset((PAGE_W - tw) / 2f, y - size); cs.showText(safe); cs.endText();
        return y - size - 1;
    }

    private float drawLabel(PDPageContentStream cs, PDType1Font fontB, PDType1Font fontN,
                            float size, String label, String value, float y) throws Exception {
        String safeLabel = ascii(label) + " ";
        cs.beginText(); cs.setFont(fontB, size);
        cs.newLineAtOffset(MARGIN, y - size); cs.showText(safeLabel); cs.endText();
        float labelW = fontB.getStringWidth(safeLabel) / 1000f * size;
        float maxW   = PAGE_W - MARGIN - (MARGIN + labelW);
        String display = ascii(value != null ? value : "-");
        if (fontN.getStringWidth(display) / 1000f * size > maxW && display.length() > 22)
            display = display.substring(0, Math.min(display.length(), 28)) + "...";
        cs.beginText(); cs.setFont(fontN, size);
        cs.newLineAtOffset(MARGIN + labelW, y - size); cs.showText(display); cs.endText();
        return y - size - 1;
    }

    private float drawDashes(PDPageContentStream cs, float y) throws Exception {
        cs.setLineWidth(0.5f);
        cs.moveTo(MARGIN, y); cs.lineTo(PAGE_W - MARGIN, y); cs.stroke();
        return y - 3;
    }

    /** Línea de corte con tijeras y texto "CORTAR AQUI" */
    private float drawCutLine(PDPageContentStream cs, PDType1Font font, float y) throws Exception {
        // Línea punteada manual (series de segmentos cortos)
        cs.setLineWidth(0.4f);
        float x = MARGIN;
        float step = 4f;
        while (x < PAGE_W - MARGIN) {
            cs.moveTo(x, y);
            cs.lineTo(Math.min(x + 2f, PAGE_W - MARGIN), y);
            cs.stroke();
            x += step;
        }
        y -= 3;
        // Texto centrado
        String cutText = "- - - - - CORTAR AQUI - - - - -";
        float tw = font.getStringWidth(cutText) / 1000f * 6f;
        cs.beginText(); cs.setFont(font, 6f);
        cs.newLineAtOffset((PAGE_W - tw) / 2f, y - 6f); cs.showText(cutText); cs.endText();
        return y - 6f - 1;
    }

    private PDImageXObject buildQrImage(PDDocument doc, String text) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
        hints.put(EncodeHintType.MARGIN, 1);
        BitMatrix matrix = writer.encode(text, BarcodeFormat.QR_CODE, 200, 200, hints);
        BufferedImage img = MatrixToImageWriter.toBufferedImage(matrix);
        return LosslessFactory.createFromImage(doc, img);
    }

    private String computeHash(String... parts) {
        try {
            String input = String.join("|", parts);
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02X", b & 0xFF));
            return sb.substring(0, 8);
        } catch (Exception e) { return "00000000"; }
    }

    private String ascii(String s) {
        if (s == null) return "";
        return s.replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')
                .replace('Á','A').replace('É','E').replace('Í','I').replace('Ó','O').replace('Ú','U')
                .replace('ñ','n').replace('Ñ','N').replace('ü','u').replace('Ü','U')
                .replace('→','>').replace('—','-').replace('–','-').replace('…','.')
                .replace('¡','!').replace('¿','?').replaceAll("[\\r\\n\\t]", " ")
                .replaceAll("[^\\x20-\\x7E]", "?");
    }
}
