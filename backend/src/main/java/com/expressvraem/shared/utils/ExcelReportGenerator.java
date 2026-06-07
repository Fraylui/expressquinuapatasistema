package com.expressvraem.shared.utils;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
public class ExcelReportGenerator {

    public byte[] generarReporteVentas(List<Map<String, Object>> datos) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Ventas");
            sheet.createFreezePane(0, 1);

            CellStyle headerStyle  = crearEstiloHeader(wb);
            CellStyle monedaStyle  = crearEstiloMoneda(wb);
            CellStyle monedaAlt    = crearEstiloMonedaAlt(wb);
            CellStyle normalStyle  = crearEstiloNormal(wb);
            CellStyle altStyle     = crearEstiloAlt(wb);
            CellStyle totalLabel   = crearEstiloTotalLabel(wb);
            CellStyle totalMoneda  = crearEstiloTotalMoneda(wb);

            String[] headers = {
                "Código", "Fecha", "Pasajero", "Documento", "Ruta",
                "Asiento", "Precio S/", "Descuento S/", "Forma Pago", "Estado"
            };
            crearFila(sheet, 0, headers, headerStyle);

            BigDecimal total = BigDecimal.ZERO;
            int row = 1;
            for (Map<String, Object> d : datos) {
                boolean alt = (row % 2 == 0);
                Row fila = sheet.createRow(row++);
                setCell(fila, 0, str(d, "codigo"),    alt ? altStyle : normalStyle);
                setCell(fila, 1, str(d, "fecha"),     alt ? altStyle : normalStyle);
                setCell(fila, 2, str(d, "pasajero"),  alt ? altStyle : normalStyle);
                setCell(fila, 3, str(d, "dni"),       alt ? altStyle : normalStyle);
                setCell(fila, 4, str(d, "ruta"),      alt ? altStyle : normalStyle);
                setCell(fila, 5, str(d, "asiento"),   alt ? altStyle : normalStyle);

                BigDecimal precio     = toBD(d.getOrDefault("precio",    "0"));
                BigDecimal descuento  = toBD(d.getOrDefault("descuento", "0"));

                Cell precioCell = fila.createCell(6);
                precioCell.setCellValue(precio.doubleValue());
                precioCell.setCellStyle(alt ? monedaAlt : monedaStyle);

                Cell descCell = fila.createCell(7);
                descCell.setCellValue(descuento.doubleValue());
                descCell.setCellStyle(alt ? monedaAlt : monedaStyle);

                setCell(fila, 8, str(d, "formaPago"), alt ? altStyle : normalStyle);
                setCell(fila, 9, str(d, "estado"),    alt ? altStyle : normalStyle);

                total = total.add(precio);
            }

            Row totalRow = sheet.createRow(row);
            Cell lbl = totalRow.createCell(5);
            lbl.setCellValue("TOTAL:");
            lbl.setCellStyle(totalLabel);
            Cell tot = totalRow.createCell(6);
            tot.setCellValue(total.doubleValue());
            tot.setCellStyle(totalMoneda);

            for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    public byte[] generarReporteEncomiendas(List<Map<String, Object>> datos) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Encomiendas");
            sheet.createFreezePane(0, 1);

            CellStyle headerStyle  = crearEstiloHeader(wb);
            CellStyle monedaStyle  = crearEstiloMoneda(wb);
            CellStyle monedaAlt    = crearEstiloMonedaAlt(wb);
            CellStyle normalStyle  = crearEstiloNormal(wb);
            CellStyle altStyle     = crearEstiloAlt(wb);
            CellStyle totalLabel   = crearEstiloTotalLabel(wb);
            CellStyle totalMoneda  = crearEstiloTotalMoneda(wb);

            String[] headers = {
                "Código", "Fecha", "Estado", "Remitente", "Destinatario",
                "Ag. Origen", "Ag. Destino", "Descripción",
                "Peso kg", "Bultos", "Frágil", "Forma Cobro", "Precio S/"
            };
            crearFila(sheet, 0, headers, headerStyle);

            int row = 1;
            BigDecimal total = BigDecimal.ZERO;
            for (Map<String, Object> d : datos) {
                boolean alt = (row % 2 == 0);
                Row fila = sheet.createRow(row++);
                setCell(fila, 0, str(d, "codigo"),        alt ? altStyle : normalStyle);
                setCell(fila, 1, str(d, "fecha"),         alt ? altStyle : normalStyle);
                setCell(fila, 2, str(d, "estado"),        alt ? altStyle : normalStyle);
                setCell(fila, 3, str(d, "remitente"),     alt ? altStyle : normalStyle);
                setCell(fila, 4, str(d, "destinatario"),  alt ? altStyle : normalStyle);
                setCell(fila, 5, str(d, "agenciaOrigen"), alt ? altStyle : normalStyle);
                setCell(fila, 6, str(d, "agenciaDestino"),alt ? altStyle : normalStyle);
                setCell(fila, 7, str(d, "descripcion"),   alt ? altStyle : normalStyle);
                setCell(fila, 8, str(d, "peso"),          alt ? altStyle : normalStyle);
                setCell(fila, 9, str(d, "numBultos"),     alt ? altStyle : normalStyle);
                setCell(fila,10, str(d, "esFragil"),      alt ? altStyle : normalStyle);
                setCell(fila,11, str(d, "formaCobro"),    alt ? altStyle : normalStyle);

                BigDecimal precio = toBD(d.getOrDefault("precio", "0"));
                Cell c = fila.createCell(12);
                c.setCellValue(precio.doubleValue());
                c.setCellStyle(alt ? monedaAlt : monedaStyle);
                total = total.add(precio);
            }

            Row totalRow = sheet.createRow(row);
            Cell lbl = totalRow.createCell(11);
            lbl.setCellValue("TOTAL:");
            lbl.setCellStyle(totalLabel);
            Cell tot = totalRow.createCell(12);
            tot.setCellValue(total.doubleValue());
            tot.setCellStyle(totalMoneda);

            for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    public byte[] generarReporteCaja(List<Map<String, Object>> movimientos) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Caja");
            sheet.createFreezePane(0, 1);

            CellStyle headerStyle = crearEstiloHeader(wb);
            CellStyle monedaStyle = crearEstiloMoneda(wb);
            CellStyle monedaAlt   = crearEstiloMonedaAlt(wb);
            CellStyle normalStyle = crearEstiloNormal(wb);
            CellStyle altStyle    = crearEstiloAlt(wb);

            String[] headers = {"Fecha", "Tipo", "Concepto", "Monto S/", "Saldo S/"};
            crearFila(sheet, 0, headers, headerStyle);

            int row = 1;
            for (Map<String, Object> m : movimientos) {
                boolean alt = (row % 2 == 0);
                Row fila = sheet.createRow(row++);
                setCell(fila, 0, str(m, "fecha"),   alt ? altStyle : normalStyle);
                setCell(fila, 1, str(m, "tipo"),    alt ? altStyle : normalStyle);
                setCell(fila, 2, str(m, "concepto"),alt ? altStyle : normalStyle);

                BigDecimal monto = toBD(m.getOrDefault("monto", "0"));
                Cell mc = fila.createCell(3);
                mc.setCellValue(monto.doubleValue());
                mc.setCellStyle(alt ? monedaAlt : monedaStyle);

                BigDecimal saldo = toBD(m.getOrDefault("saldo", "0"));
                Cell sc = fila.createCell(4);
                sc.setCellValue(saldo.doubleValue());
                sc.setCellStyle(alt ? monedaAlt : monedaStyle);
            }

            for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    public byte[] generarReporteAuditoria(List<Map<String, Object>> datos) throws IOException {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Auditoría");
            sheet.createFreezePane(0, 1);
            CellStyle headerStyle = crearEstiloHeader(wb);
            CellStyle normalStyle = crearEstiloNormal(wb);
            CellStyle altStyle    = crearEstiloAlt(wb);

            String[] headers = {"Fecha/Hora", "Usuario", "Módulo", "Acción", "Entidad", "Registro ID", "Detalle", "IP"};
            crearFila(sheet, 0, headers, headerStyle);

            int row = 1;
            for (Map<String, Object> d : datos) {
                boolean alt = (row % 2 == 0);
                Row fila = sheet.createRow(row++);
                setCell(fila, 0, str(d, "fecha"),      alt ? altStyle : normalStyle);
                setCell(fila, 1, str(d, "usuario"),    alt ? altStyle : normalStyle);
                setCell(fila, 2, str(d, "modulo"),     alt ? altStyle : normalStyle);
                setCell(fila, 3, str(d, "accion"),     alt ? altStyle : normalStyle);
                setCell(fila, 4, str(d, "entidad"),    alt ? altStyle : normalStyle);
                setCell(fila, 5, str(d, "registroId"), alt ? altStyle : normalStyle);
                setCell(fila, 6, str(d, "detalle"),    alt ? altStyle : normalStyle);
                setCell(fila, 7, str(d, "ip"),         alt ? altStyle : normalStyle);
            }

            for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    // ── Estilos ───────────────────────────────────────────────────────────────────

    private CellStyle crearEstiloHeader(XSSFWorkbook wb) {
        XSSFCellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(new byte[]{(byte)4, (byte)61, (byte)47}, null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(IndexedColors.WHITE.getIndex());
        return style;
    }

    private CellStyle crearEstiloNormal(XSSFWorkbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        return style;
    }

    private CellStyle crearEstiloAlt(XSSFWorkbook wb) {
        XSSFCellStyle style = wb.createCellStyle();
        style.setFillForegroundColor(new XSSFColor(new byte[]{(byte)240, (byte)253, (byte)244}, null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        return style;
    }

    private CellStyle crearEstiloMoneda(XSSFWorkbook wb) {
        CellStyle style = wb.createCellStyle();
        DataFormat format = wb.createDataFormat();
        style.setDataFormat(format.getFormat("\"S/\"#,##0.00"));
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        return style;
    }

    private CellStyle crearEstiloMonedaAlt(XSSFWorkbook wb) {
        XSSFCellStyle style = wb.createCellStyle();
        DataFormat format = wb.createDataFormat();
        style.setDataFormat(format.getFormat("\"S/\"#,##0.00"));
        style.setFillForegroundColor(new XSSFColor(new byte[]{(byte)240, (byte)253, (byte)244}, null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBottomBorderColor(IndexedColors.GREY_25_PERCENT.getIndex());
        return style;
    }

    private CellStyle crearEstiloTotalLabel(XSSFWorkbook wb) {
        XSSFCellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(new XSSFColor(new byte[]{(byte)4, (byte)61, (byte)47}, null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font labelFont = wb.createFont();
        labelFont.setBold(true);
        labelFont.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(labelFont);
        style.setAlignment(HorizontalAlignment.RIGHT);
        return style;
    }

    private CellStyle crearEstiloTotalMoneda(XSSFWorkbook wb) {
        XSSFCellStyle style = wb.createCellStyle();
        DataFormat format = wb.createDataFormat();
        style.setDataFormat(format.getFormat("\"S/\"#,##0.00"));
        style.setFillForegroundColor(new XSSFColor(new byte[]{(byte)4, (byte)61, (byte)47}, null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private void crearFila(Sheet sheet, int rowNum, String[] values, CellStyle style) {
        Row row = sheet.createRow(rowNum);
        row.setHeight((short) 500);
        for (int i = 0; i < values.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(values[i]);
            cell.setCellStyle(style);
        }
    }

    private void setCell(Row row, int col, String value, CellStyle style) {
        Cell cell = row.createCell(col);
        cell.setCellValue(value != null ? value : "");
        cell.setCellStyle(style);
    }

    private String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v != null ? String.valueOf(v) : "";
    }

    private BigDecimal toBD(Object v) {
        try { return new BigDecimal(String.valueOf(v)); }
        catch (Exception e) { return BigDecimal.ZERO; }
    }
}
