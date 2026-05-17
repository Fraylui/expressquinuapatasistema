package com.expressvraem.modules.reportes.service;

import com.expressvraem.modules.auditoria.repository.AuditoriaRepository;
import com.expressvraem.modules.caja.entity.Caja;
import com.expressvraem.modules.caja.repository.CajaRepository;
import com.expressvraem.modules.encomiendas.repository.EncomiendaRepository;
import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.modules.caja.repository.MovimientoCajaRepository;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.expressvraem.shared.utils.ExcelReportGenerator;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReporteService {

    private final PasajeRepository pasajeRepository;
    private final EncomiendaRepository encomiendaRepository;
    private final MovimientoCajaRepository movimientoRepository;
    private final CajaRepository cajaRepository;
    private final AuditoriaRepository auditoriaRepository;
    private final ExcelReportGenerator excelGenerator;
    private final EntityManager entityManager;

    /**
     * COBIT MEA01 + COSO: KPIs en tiempo real para el gerente.
     * Incluye métricas de control interno y seguridad.
     */
    public Map<String, Object> getKpisGerente(Long agenciaId) {
        LocalDateTime inicioDia = LocalDate.now().atStartOfDay();
        LocalDateTime finDia    = LocalDate.now().atTime(23, 59, 59);

        // Pasajes vendidos hoy
        long pasajesHoy = pasajeRepository
                .findByAgenciaIdAndFechaEmisionBetween(agenciaId, inicioDia, finDia).size();

        // Ingresos hoy (COSO: actividades de control financiero)
        BigDecimal ingresosHoy = movimientoRepository
                .findByAgenciaIdAndTipoAndCreatedAtBetween(agenciaId, "INGRESO", inicioDia, finDia)
                .stream()
                .map(m -> m.getMonto())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Encomiendas activas hoy (EN_TRANSITO)
        long encomiendaActivas = encomiendaRepository
                .findByAgenciaIdAndEstado(agenciaId, "EN_TRANSITO").size();

        // Cajas abiertas (COSO: evaluación de riesgos financieros)
        List<Caja> cajasAbiertas = cajaRepository.findByAgenciaIdAndEstado(agenciaId, "ABIERTA");
        long cajasSinDiferencia = cajasAbiertas.size();

        // Auditoría hoy (COBIT MEA01 + COBIT MEA02)
        long auditoriaHoy = auditoriaRepository.countByAgenciaIdAndFechaAfter(agenciaId, inicioDia);

        return Map.of(
                "pasajesHoy",       pasajesHoy,
                "ingresosHoy",      ingresosHoy,
                "encomiendaActivas",encomiendaActivas,
                "cajasAbiertas",    cajasSinDiferencia,
                "auditoriaHoy",     auditoriaHoy,
                "fechaHora",        LocalDateTime.now().toString()
        );
    }

    public byte[] generarReporteVentas(LocalDateTime desde, LocalDateTime hasta, Long agenciaId) throws IOException {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        var pasajes = pasajeRepository.findByAgenciaIdAndFechaEmisionBetween(ag, desde, hasta);
        List<Map<String, Object>> datos = pasajes.stream().map(p -> Map.<String, Object>of(
                "codigo", p.getCodigoPasaje() != null ? p.getCodigoPasaje() : p.getId().toString(),
                "fecha", p.getFechaEmision().toString(),
                "pasajero", p.getClienteId().toString(),
                "dni", "",
                "ruta", p.getViajeId().toString(),
                "asiento", p.getAsientoId().toString(),
                "precio", p.getPrecioFinal().toString()
        )).collect(Collectors.toList());
        return excelGenerator.generarReporteVentas(datos);
    }

    public byte[] generarReporteEncomiendas(Long agenciaId, String estado) throws IOException {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        var encomiendas = encomiendaRepository.findByAgenciaIdAndEstado(ag, estado != null ? estado : "ENTREGADO");
        List<Map<String, Object>> datos = encomiendas.stream().map(e -> Map.<String, Object>of(
                "codigo", e.getCodigoTracking(),
                "fecha", e.getFechaRegistro().toString(),
                "remitente", e.getRemitenteId().toString(),
                "destinatario", e.getDestinatarioId().toString(),
                "descripcion", e.getDescripcion(),
                "peso", e.getPesoKg() != null ? e.getPesoKg().toString() : "0",
                "precio", e.getPrecioEnvio().toString()
        )).collect(Collectors.toList());
        return excelGenerator.generarReporteEncomiendas(datos);
    }

    public List<Map<String, Object>> getTendencia(Long agenciaId, int dias) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM");
        List<Map<String, Object>> resultado = new ArrayList<>();

        for (int i = dias - 1; i >= 0; i--) {
            LocalDate fecha = LocalDate.now().minusDays(i);
            LocalDateTime inicio = fecha.atStartOfDay();
            LocalDateTime fin    = fecha.atTime(23, 59, 59);

            // Pasajes del día
            long pasajes = 0;
            BigDecimal ingresos = BigDecimal.ZERO;
            try {
                Object[] row = (Object[]) entityManager.createNativeQuery(
                    "SELECT COUNT(*), COALESCE(SUM(precio_final), 0) FROM pasajes " +
                    "WHERE (:ag IS NULL OR agencia_id = :ag) AND estado != 'ANULADO' " +
                    "AND fecha_emision BETWEEN :ini AND :fin")
                    .setParameter("ag", agenciaId)
                    .setParameter("ini", inicio)
                    .setParameter("fin", fin)
                    .getSingleResult();
                pasajes  = row[0] != null ? ((Number) row[0]).longValue() : 0;
                ingresos = row[1] != null ? new BigDecimal(row[1].toString()) : BigDecimal.ZERO;
            } catch (Exception ignored) {}

            // Encomiendas del día
            long encomiendas = 0;
            try {
                Object count = entityManager.createNativeQuery(
                    "SELECT COUNT(*) FROM encomiendas " +
                    "WHERE (:ag IS NULL OR agencia_id = :ag) " +
                    "AND fecha_registro BETWEEN :ini AND :fin")
                    .setParameter("ag", agenciaId)
                    .setParameter("ini", inicio)
                    .setParameter("fin", fin)
                    .getSingleResult();
                encomiendas = count != null ? ((Number) count).longValue() : 0;
            } catch (Exception ignored) {}

            Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("fecha",       fecha.format(fmt));
            item.put("pasajes",     pasajes);
            item.put("encomiendas", encomiendas);
            item.put("ingresos",    ingresos.doubleValue());
            resultado.add(item);
        }
        return resultado;
    }

    public byte[] generarReporteCaja(Long cajaId) throws IOException {
        var movimientos = movimientoRepository.findByCajaIdOrderByCreatedAtAsc(cajaId);
        List<Map<String, Object>> datos = movimientos.stream().map(m -> Map.<String, Object>of(
                "fecha", m.getCreatedAt().toString(),
                "tipo", m.getTipo(),
                "concepto", m.getConcepto(),
                "monto", m.getMonto().toString(),
                "saldo", m.getSaldoAcumulado() != null ? m.getSaldoAcumulado().toString() : "0"
        )).collect(Collectors.toList());
        return excelGenerator.generarReporteCaja(datos);
    }
}
