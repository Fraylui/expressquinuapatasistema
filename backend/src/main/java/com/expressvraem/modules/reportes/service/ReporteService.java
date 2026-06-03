package com.expressvraem.modules.reportes.service;

import com.expressvraem.modules.auditoria.repository.AuditoriaRepository;
import com.expressvraem.modules.caja.entity.Caja;
import com.expressvraem.modules.caja.repository.CajaRepository;
import com.expressvraem.modules.encomiendas.repository.EncomiendaRepository;
import com.expressvraem.modules.encomiendas.service.EncomiendaService;
import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.modules.caja.repository.MovimientoCajaRepository;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.expressvraem.shared.utils.ExcelReportGenerator;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final EncomiendaService encomiendaService;
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
                .findByAgenciaIdOptionalAndTipoAndCreatedAtBetween(agenciaId, "INGRESO", inicioDia, finDia)
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

        // Viajes activos hoy (PROGRAMADO + EN_RUTA con salida hoy)
        long viajesActivosHoy = 0;
        try {
            Object cnt = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM viajes WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND estado IN ('PROGRAMADO','EN_RUTA') AND DATE(fecha_hora_sal) = CURRENT_DATE")
                .setParameter("ag", agenciaId).getSingleResult();
            viajesActivosHoy = cnt != null ? ((Number) cnt).longValue() : 0;
        } catch (Exception ignored) {}

        // Diferencias de caja detectadas hoy (COSO: actividades de control)
        long diferenciasHoy = 0;
        try {
            Object cnt = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM caja WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND estado = 'CERRADA' AND DATE(fecha_cierre) = CURRENT_DATE " +
                "AND diferencia IS NOT NULL AND ABS(diferencia) > 0")
                .setParameter("ag", agenciaId).getSingleResult();
            diferenciasHoy = cnt != null ? ((Number) cnt).longValue() : 0;
        } catch (Exception ignored) {}

        java.util.Map<String, Object> kpis = new java.util.LinkedHashMap<>();
        kpis.put("pasajesHoy",        pasajesHoy);
        kpis.put("ingresosHoy",       ingresosHoy);
        kpis.put("encomiendaActivas", encomiendaActivas);
        kpis.put("cajasAbiertas",     cajasSinDiferencia);
        kpis.put("auditoriaHoy",      auditoriaHoy);
        kpis.put("viajesActivosHoy",  viajesActivosHoy);
        kpis.put("diferenciasHoy",    diferenciasHoy);
        kpis.put("fechaHora",         LocalDateTime.now().toString());
        return kpis;
    }

    /** Ventas por hora del día — para gráfico del dashboard gerencial. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getVentasPorHora(Long agenciaId) {
        List<Object[]> rows = new ArrayList<>();
        try {
            rows = entityManager.createNativeQuery(
                "SELECT CAST(EXTRACT(HOUR FROM fecha_emision) AS INT), " +
                "COUNT(*), COALESCE(SUM(precio_final), 0) " +
                "FROM pasajes WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND estado != 'ANULADO' AND DATE(fecha_emision) = CURRENT_DATE " +
                "GROUP BY 1 ORDER BY 1")
                .setParameter("ag", agenciaId).getResultList();
        } catch (Exception ignored) {}

        java.util.Map<Integer, Object[]> byHour = new java.util.TreeMap<>();
        for (Object[] r : rows) byHour.put(((Number) r[0]).intValue(), r);

        List<Map<String, Object>> result = new ArrayList<>();
        for (int h = 5; h <= 22; h++) {
            Object[] r = byHour.get(h);
            java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("hora",    String.format("%02d:00", h));
            item.put("pasajes", r != null ? ((Number) r[1]).longValue() : 0L);
            item.put("ingresos", r != null ? new BigDecimal(r[2].toString()).doubleValue() : 0.0);
            result.add(item);
        }
        return result;
    }

    /** Viajes del día con conteo de pasajeros vendidos vs. capacidad. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getViajesDelDia(Long agenciaId) {
        List<Object[]> rows = new ArrayList<>();
        try {
            rows = entityManager.createNativeQuery(
                "SELECT v.id, v.estado, v.fecha_hora_sal, r.origen, r.destino, " +
                "ve.placa, ve.tipo, ve.num_asientos, " +
                "(SELECT COUNT(*) FROM pasajes p WHERE p.viaje_id = v.id AND p.estado != 'ANULADO') " +
                "FROM viajes v JOIN rutas r ON r.id = v.ruta_id " +
                "JOIN vehiculos ve ON ve.id = v.vehiculo_id " +
                "WHERE (CAST(:ag AS BIGINT) IS NULL OR v.agencia_id = :ag) " +
                "AND DATE(v.fecha_hora_sal) = CURRENT_DATE ORDER BY v.fecha_hora_sal")
                .setParameter("ag", agenciaId).getResultList();
        } catch (Exception ignored) {}

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] r : rows) {
            String hora = "—";
            try {
                if (r[2] instanceof java.sql.Timestamp ts)
                    hora = ts.toLocalDateTime().format(fmt);
                else if (r[2] instanceof java.time.OffsetDateTime odt)
                    hora = odt.format(fmt);
            } catch (Exception ignored) {}

            java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("viajeId",           ((Number) r[0]).longValue());
            item.put("estado",            str(r[1]));
            item.put("hora",              hora);
            item.put("origen",            str(r[3]));
            item.put("destino",           str(r[4]));
            item.put("placa",             str(r[5]));
            item.put("tipo",              str(r[6]));
            item.put("totalAsientos",     r[7] != null ? ((Number) r[7]).intValue() - 1 : 0);
            item.put("pasajerosVendidos", r[8] != null ? ((Number) r[8]).longValue() : 0L);
            result.add(item);
        }
        return result;
    }

    /** Encomiendas sin cambio de estado en más de 24 horas. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getEncomiendasPendientes(Long agenciaId) {
        List<Object[]> rows = new ArrayList<>();
        try {
            rows = entityManager.createNativeQuery(
                "SELECT e.id, e.codigo_tracking, e.estado, e.descripcion, " +
                "CAST(EXTRACT(EPOCH FROM (NOW() - e.fecha_registro))/3600 AS INT), " +
                "c1.nombres || ' ' || c1.apellidos, c2.nombres || ' ' || c2.apellidos " +
                "FROM encomiendas e " +
                "LEFT JOIN clientes c1 ON c1.id = e.remitente_id " +
                "LEFT JOIN clientes c2 ON c2.id = e.destinatario_id " +
                "WHERE (CAST(:ag AS BIGINT) IS NULL OR e.agencia_id = :ag) " +
                "AND e.estado NOT IN ('ENTREGADO','DEVUELTO') " +
                "AND e.fecha_registro < NOW() - INTERVAL '24 hours' " +
                "ORDER BY e.fecha_registro ASC LIMIT 20")
                .setParameter("ag", agenciaId).getResultList();
        } catch (Exception ignored) {}

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] r : rows) {
            java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("id",             ((Number) r[0]).longValue());
            item.put("codigoTracking", str(r[1]));
            item.put("estado",         str(r[2]));
            item.put("descripcion",    str(r[3]));
            item.put("horas",          r[4] != null ? ((Number) r[4]).intValue() : 0);
            item.put("remitente",      str(r[5]));
            item.put("destinatario",   str(r[6]));
            result.add(item);
        }
        return result;
    }

    /**
     * Comparativa hoy vs ayer para mostrar deltas en KPIs del dashboard.
     * Retorna pasajes, ingresos y encomiendas con su variación porcentual.
     */
    public Map<String, Object> getComparativa(Long agenciaId) {
        long pasajesHoy = 0, pasajesAyer = 0;
        BigDecimal ingresosHoy = BigDecimal.ZERO, ingresosAyer = BigDecimal.ZERO;
        long encHoy = 0, encAyer = 0;

        try {
            Object[] r = (Object[]) entityManager.createNativeQuery(
                "SELECT COUNT(*), COALESCE(SUM(precio_final),0) FROM pasajes " +
                "WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id=:ag) AND estado!='ANULADO' AND DATE(fecha_emision)=CURRENT_DATE")
                .setParameter("ag", agenciaId).getSingleResult();
            pasajesHoy  = ((Number) r[0]).longValue();
            ingresosHoy = new BigDecimal(r[1].toString());
        } catch (Exception ignored) {}

        try {
            Object[] r = (Object[]) entityManager.createNativeQuery(
                "SELECT COUNT(*), COALESCE(SUM(precio_final),0) FROM pasajes " +
                "WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id=:ag) AND estado!='ANULADO' AND DATE(fecha_emision)=CURRENT_DATE-1")
                .setParameter("ag", agenciaId).getSingleResult();
            pasajesAyer  = ((Number) r[0]).longValue();
            ingresosAyer = new BigDecimal(r[1].toString());
        } catch (Exception ignored) {}

        try {
            Object c = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM encomiendas WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id=:ag) AND DATE(fecha_registro)=CURRENT_DATE")
                .setParameter("ag", agenciaId).getSingleResult();
            encHoy = ((Number) c).longValue();
        } catch (Exception ignored) {}

        try {
            Object c = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM encomiendas WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id=:ag) AND DATE(fecha_registro)=CURRENT_DATE-1")
                .setParameter("ag", agenciaId).getSingleResult();
            encAyer = ((Number) c).longValue();
        } catch (Exception ignored) {}

        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("pasajesHoy",      pasajesHoy);
        m.put("pasajesAyer",     pasajesAyer);
        m.put("pasajesDelta",    delta(pasajesHoy, pasajesAyer));
        m.put("ingresosHoy",     ingresosHoy);
        m.put("ingresosAyer",    ingresosAyer);
        m.put("ingresosDelta",   delta(ingresosHoy, ingresosAyer));
        m.put("encomiendasHoy",  encHoy);
        m.put("encomiendasAyer", encAyer);
        m.put("encomiendas Delta", delta(encHoy, encAyer));
        return m;
    }

    /** Top 5 rutas por número de pasajes en los últimos N días. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getTopRutas(Long agenciaId, int dias) {
        List<Object[]> rows = new ArrayList<>();
        try {
            rows = entityManager.createNativeQuery(
                "SELECT r.origen, r.destino, COUNT(p.id) AS cnt, COALESCE(SUM(p.precio_final),0) AS ingresos " +
                "FROM pasajes p JOIN viajes v ON v.id=p.viaje_id JOIN rutas r ON r.id=v.ruta_id " +
                "WHERE (CAST(:ag AS BIGINT) IS NULL OR p.agencia_id=:ag) AND p.estado!='ANULADO' " +
                "AND p.fecha_emision >= NOW() - CAST(:dias || ' days' AS INTERVAL) " +
                "GROUP BY r.origen, r.destino ORDER BY cnt DESC LIMIT 5")
                .setParameter("ag", agenciaId)
                .setParameter("dias", dias)
                .getResultList();
        } catch (Exception ignored) {}

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] r : rows) {
            Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("ruta",     str(r[0]) + " › " + str(r[1]));
            item.put("origen",   str(r[0]));
            item.put("destino",  str(r[1]));
            item.put("pasajes",  ((Number) r[2]).longValue());
            item.put("ingresos", new BigDecimal(r[3].toString()).doubleValue());
            result.add(item);
        }
        return result;
    }

    private double delta(long hoy, long ayer) {
        if (ayer == 0) return hoy > 0 ? 100.0 : 0.0;
        return Math.round(((double)(hoy - ayer) / ayer) * 1000.0) / 10.0;
    }

    private double delta(BigDecimal hoy, BigDecimal ayer) {
        if (ayer.compareTo(BigDecimal.ZERO) == 0) return hoy.compareTo(BigDecimal.ZERO) > 0 ? 100.0 : 0.0;
        return Math.round(hoy.subtract(ayer).divide(ayer, 6, java.math.RoundingMode.HALF_UP).doubleValue() * 1000.0) / 10.0;
    }

    private String str(Object o) { return o != null ? String.valueOf(o) : "—"; }

    @Transactional(readOnly = true)
    public byte[] generarReporteVentas(LocalDateTime desde, LocalDateTime hasta, Long agenciaId) throws IOException {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        var pasajes = ag != null
                ? pasajeRepository.findByAgenciaIdAndFechaEmisionBetween(ag, desde, hasta)
                : pasajeRepository.findByFechaEmisionBetween(desde, hasta);
        DateTimeFormatter fmtFecha = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        List<Map<String, Object>> datos = pasajes.stream().map(p -> {
            String pasajero = "—", dni = "—", ruta = "—";
            try {
                Object[] cl = (Object[]) entityManager
                        .createNativeQuery("SELECT apellidos || ', ' || nombres, num_doc FROM clientes WHERE id = :id")
                        .setParameter("id", p.getClienteId()).getSingleResult();
                pasajero = cl[0] != null ? String.valueOf(cl[0]) : "—";
                dni      = cl[1] != null ? String.valueOf(cl[1]) : "—";
            } catch (Exception ignored) {}
            try {
                Object[] r = (Object[]) entityManager
                        .createNativeQuery("SELECT r.origen, r.destino FROM viajes v JOIN rutas r ON r.id = v.ruta_id WHERE v.id = :id")
                        .setParameter("id", p.getViajeId()).getSingleResult();
                ruta = str(r[0]) + " → " + str(r[1]);
            } catch (Exception ignored) {}
            String fecha = p.getFechaEmision() != null ? p.getFechaEmision().format(fmtFecha) : "—";
            String asiento = p.getAsientoNumero() != null ? String.valueOf(p.getAsientoNumero()) : "—";
            java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("codigo",  p.getCorrelativo() != null ? p.getCorrelativo() : p.getId().toString());
            row.put("fecha",   fecha);
            row.put("pasajero", pasajero);
            row.put("dni",     dni);
            row.put("ruta",    ruta);
            row.put("asiento", asiento);
            row.put("precio",  p.getPrecioFinal() != null ? p.getPrecioFinal().toString() : "0");
            return row;
        }).collect(Collectors.toList());
        return excelGenerator.generarReporteVentas(datos);
    }

    @Transactional(readOnly = true)
    public byte[] generarReporteEncomiendas(Long agenciaId, String estado, String desde, String hasta) throws IOException {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        java.time.LocalDateTime desdeDate = desde != null && !desde.isBlank()
                ? java.time.LocalDateTime.parse(desde.replace(" ", "T").substring(0, 19)) : null;
        java.time.LocalDateTime hastaDate = hasta != null && !hasta.isBlank()
                ? java.time.LocalDateTime.parse(hasta.replace(" ", "T").substring(0, 19)) : null;
        var encomiendas = encomiendaService.buscarConFiltros(ag, estado, null, desdeDate, hastaDate, null);
        DateTimeFormatter fmtFecha = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        List<Map<String, Object>> datos = encomiendas.stream().map(e -> {
            String remitente = "—", destinatario = "—";
            try {
                Object r = entityManager
                        .createNativeQuery("SELECT apellidos || ', ' || nombres FROM clientes WHERE id = :id")
                        .setParameter("id", e.getRemitenteId()).getSingleResult();
                remitente = r != null ? String.valueOf(r) : "—";
            } catch (Exception ignored) {}
            try {
                Object r = entityManager
                        .createNativeQuery("SELECT apellidos || ', ' || nombres FROM clientes WHERE id = :id")
                        .setParameter("id", e.getDestinatarioId()).getSingleResult();
                destinatario = r != null ? String.valueOf(r) : "—";
            } catch (Exception ignored) {}
            String fecha = e.getFechaRegistro() != null ? e.getFechaRegistro().format(fmtFecha) : "—";
            java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("codigo",      e.getCodigoTracking());
            row.put("fecha",       fecha);
            row.put("remitente",   remitente);
            row.put("destinatario", destinatario);
            row.put("descripcion", e.getDescripcion());
            row.put("peso",        e.getPesoKg() != null ? e.getPesoKg().toString() : "0");
            row.put("precio",      e.getPrecioEnvio() != null ? e.getPrecioEnvio().toString() : "0");
            return row;
        }).collect(Collectors.toList());
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
                    "WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) AND estado != 'ANULADO' " +
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
                    "WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
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
        return buildCajaExcel(movimientos);
    }

    public byte[] generarReporteCajaPorFecha(Long agenciaId, LocalDateTime desde, LocalDateTime hasta) throws IOException {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        var movimientos = ag != null
                ? movimientoRepository.findByAgenciaIdAndCreatedAtBetween(ag, desde, hasta)
                : movimientoRepository.findByCreatedAtBetween(desde, hasta);
        return buildCajaExcel(movimientos);
    }

    private byte[] buildCajaExcel(java.util.List<com.expressvraem.modules.caja.entity.MovimientoCaja> movimientos) throws IOException {
        DateTimeFormatter fmtFecha = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        List<Map<String, Object>> datos = movimientos.stream().map(m -> {
            java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("fecha",    m.getCreatedAt() != null ? m.getCreatedAt().format(fmtFecha) : "—");
            row.put("tipo",     m.getTipo());
            row.put("concepto", m.getConcepto());
            row.put("monto",    m.getMonto().toString());
            row.put("saldo",    m.getSaldoAcumulado() != null ? m.getSaldoAcumulado().toString() : "0");
            return (Map<String, Object>) row;
        }).collect(Collectors.toList());
        return excelGenerator.generarReporteCaja(datos);
    }
}
