package com.expressvraem.shared.utils;

import org.apache.poi.ss.usermodel.*;
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
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Ventas");
            CellStyle headerStyle = crearEstiloHeader(wb);
            CellStyle monedaStyle = crearEstiloMoneda(wb);

            String[] headers = {"Código", "Fecha", "Pasajero", "DNI", "Ruta", "Asiento", "Precio S/"};
            crearFila(sheet, 0, headers, headerStyle);

            BigDecimal total = BigDecimal.ZERO;
            int row = 1;
            for (Map<String, Object> d : datos) {
                Row fila = sheet.createRow(row++);
                fila.createCell(0).setCellValue(String.valueOf(d.getOrDefault("codigo", "")));
                fila.createCell(1).setCellValue(String.valueOf(d.getOrDefault("fecha", "")));
                fila.createCell(2).setCellValue(String.valueOf(d.getOrDefault("pasajero", "")));
                fila.createCell(3).setCellValue(String.valueOf(d.getOrDefault("dni", "")));
                fila.createCell(4).setCellValue(String.valueOf(d.getOrDefault("ruta", "")));
                fila.createCell(5).setCellValue(String.valueOf(d.getOrDefault("asiento", "")));
                BigDecimal precio = new BigDecimal(String.valueOf(d.getOrDefault("precio", "0")));
                Cell precioCell = fila.createCell(6);
                precioCell.setCellValue(precio.doubleValue());
                precioCell.setCellStyle(monedaStyle);
                total = total.add(precio);
            }

            Row totalRow = sheet.createRow(row);
            Cell totalLabel = totalRow.createCell(5);
            totalLabel.setCellValue("TOTAL:");
            CellStyle boldStyle = wb.createCellStyle();
            Font boldFont = wb.createFont();
            boldFont.setBold(true);
            boldStyle.setFont(boldFont);
            totalLabel.setCellStyle(boldStyle);
            Cell totalCell = totalRow.createCell(6);
            totalCell.setCellValue(total.doubleValue());
            totalCell.setCellStyle(monedaStyle);

            for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    public byte[] generarReporteEncomiendas(List<Map<String, Object>> datos) throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Encomiendas");
            CellStyle headerStyle = crearEstiloHeader(wb);
            CellStyle monedaStyle = crearEstiloMoneda(wb);

            String[] headers = {"Código", "Fecha", "Remitente", "Destinatario", "Descripción", "Peso kg", "Precio S/"};
            crearFila(sheet, 0, headers, headerStyle);

            int row = 1;
            BigDecimal total = BigDecimal.ZERO;
            for (Map<String, Object> d : datos) {
                Row fila = sheet.createRow(row++);
                fila.createCell(0).setCellValue(String.valueOf(d.getOrDefault("codigo", "")));
                fila.createCell(1).setCellValue(String.valueOf(d.getOrDefault("fecha", "")));
                fila.createCell(2).setCellValue(String.valueOf(d.getOrDefault("remitente", "")));
                fila.createCell(3).setCellValue(String.valueOf(d.getOrDefault("destinatario", "")));
                fila.createCell(4).setCellValue(String.valueOf(d.getOrDefault("descripcion", "")));
                fila.createCell(5).setCellValue(String.valueOf(d.getOrDefault("peso", "")));
                BigDecimal precio = new BigDecimal(String.valueOf(d.getOrDefault("precio", "0")));
                Cell c = fila.createCell(6);
                c.setCellValue(precio.doubleValue());
                c.setCellStyle(monedaStyle);
                total = total.add(precio);
            }

            for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    public byte[] generarReporteCaja(List<Map<String, Object>> movimientos) throws IOException {
        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Caja");
            CellStyle headerStyle = crearEstiloHeader(wb);
            CellStyle monedaStyle = crearEstiloMoneda(wb);

            String[] headers = {"Fecha", "Tipo", "Concepto", "Monto S/", "Saldo S/"};
            crearFila(sheet, 0, headers, headerStyle);

            int row = 1;
            for (Map<String, Object> m : movimientos) {
                Row fila = sheet.createRow(row++);
                fila.createCell(0).setCellValue(String.valueOf(m.getOrDefault("fecha", "")));
                fila.createCell(1).setCellValue(String.valueOf(m.getOrDefault("tipo", "")));
                fila.createCell(2).setCellValue(String.valueOf(m.getOrDefault("concepto", "")));
                BigDecimal monto = new BigDecimal(String.valueOf(m.getOrDefault("monto", "0")));
                Cell montoCell = fila.createCell(3);
                montoCell.setCellValue(monto.doubleValue());
                montoCell.setCellStyle(monedaStyle);
                BigDecimal saldo = new BigDecimal(String.valueOf(m.getOrDefault("saldo", "0")));
                Cell saldoCell = fila.createCell(4);
                saldoCell.setCellValue(saldo.doubleValue());
                saldoCell.setCellStyle(monedaStyle);
            }

            for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    private CellStyle crearEstiloHeader(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    private CellStyle crearEstiloMoneda(Workbook wb) {
        CellStyle style = wb.createCellStyle();
        DataFormat format = wb.createDataFormat();
        style.setDataFormat(format.getFormat("\"S/\"#,##0.00"));
        return style;
    }

    private void crearFila(Sheet sheet, int rowNum, String[] values, CellStyle style) {
        Row row = sheet.createRow(rowNum);
        for (int i = 0; i < values.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(values[i]);
            cell.setCellStyle(style);
        }
    }
}
