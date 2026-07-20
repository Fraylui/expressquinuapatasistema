package com.expressvraem.modules.reportes.service;

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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReporteService {

    private final PasajeRepository pasajeRepository;
    private final EncomiendaService encomiendaService;
    private final MovimientoCajaRepository movimientoRepository;
    private final com.expressvraem.modules.caja.repository.EntregaEfectivoRepository entregaEfectivoRepository;
    private final ExcelReportGenerator excelGenerator;
    private final EntityManager entityManager;

    /**
     * COBIT MEA01 + COSO: KPIs en tiempo real para el gerente.
     * Incluye métricas de control interno y seguridad.
     */
    public Map<String, Object> getKpisGerente(Long agenciaId) {
        LocalDateTime inicioDia = LocalDate.now().atStartOfDay();
        LocalDateTime finDia    = LocalDate.now().atTime(23, 59, 59);

        long pasajesHoy = 0;
        try {
            Object cnt = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM pasajes WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND estado != 'ANULADO' AND fecha_emision BETWEEN :ini AND :fin")
                .setParameter("ag", agenciaId).setParameter("ini", inicioDia).setParameter("fin", finDia).getSingleResult();
            pasajesHoy = cnt != null ? ((Number) cnt).longValue() : 0;
        } catch (Exception ignored) {}

        BigDecimal ingresosHoy = movimientoRepository
                .findByAgenciaIdOptionalAndTipoAndCreatedAtBetween(agenciaId, "INGRESO", inicioDia, finDia)
                .stream().map(m -> m.getMonto()).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Desglose de hoy por categoría: pasajes camioneta/combi, cuotas combi, encomiendas, externas
        Map<String, Object> ingresosPorCategoria = new java.util.LinkedHashMap<>();
        try {
            List<?> catRows = entityManager.createNativeQuery(
                "SELECT COALESCE(categoria_ingreso,'OTRO'), SUM(monto) FROM movimientos_caja " +
                "WHERE tipo = 'INGRESO' AND (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND created_at BETWEEN :ini AND :fin GROUP BY 1")
                .setParameter("ag", agenciaId).setParameter("ini", inicioDia).setParameter("fin", finDia)
                .getResultList();
            for (Object row : catRows) {
                Object[] r = (Object[]) row;
                ingresosPorCategoria.put(String.valueOf(r[0]),
                        r[1] != null ? new BigDecimal(r[1].toString()) : BigDecimal.ZERO);
            }
        } catch (Exception ignored) {}

        long encomiendaActivas = 0;
        try {
            Object cnt = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM encomiendas WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND estado = 'EN_TRANSITO'")
                .setParameter("ag", agenciaId).getSingleResult();
            encomiendaActivas = cnt != null ? ((Number) cnt).longValue() : 0;
        } catch (Exception ignored) {}

        long cajasAbiertas = 0;
        try {
            Object cnt = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM caja WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND estado = 'ABIERTA'")
                .setParameter("ag", agenciaId).getSingleResult();
            cajasAbiertas = cnt != null ? ((Number) cnt).longValue() : 0;
        } catch (Exception ignored) {}

        long auditoriaHoy = 0;
        try {
            Object cnt = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM auditoria WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND fecha >= :ini")
                .setParameter("ag", agenciaId).setParameter("ini", inicioDia).getSingleResult();
            auditoriaHoy = cnt != null ? ((Number) cnt).longValue() : 0;
        } catch (Exception ignored) {}

        long viajesActivosHoy = 0;
        try {
            Object cnt = entityManager.createNativeQuery(
                "SELECT COUNT(*) FROM viajes WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND estado IN ('PROGRAMADO','EN_RUTA') AND DATE(fecha_hora_sal) = CURRENT_DATE")
                .setParameter("ag", agenciaId).getSingleResult();
            viajesActivosHoy = cnt != null ? ((Number) cnt).longValue() : 0;
        } catch (Exception ignored) {}

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
        kpis.put("ingresosPorCategoria", ingresosPorCategoria);
        kpis.put("encomiendaActivas", encomiendaActivas);
        kpis.put("cajasAbiertas",     cajasAbiertas);
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

    /** Encomiendas sin cambio de estado en más de 24 horas, con nivel de criticidad. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getEncomiendasPendientes(Long agenciaId) {
        List<Object[]> rows = new ArrayList<>();
        try {
            rows = entityManager.createNativeQuery(
                "SELECT e.id, e.codigo_tracking, e.estado, e.descripcion, " +
                "CAST(EXTRACT(EPOCH FROM (NOW() - e.fecha_registro))/3600 AS INT), " +
                "c1.nombres || ' ' || c1.apellidos, c2.nombres || ' ' || c2.apellidos, " +
                "e.es_fragil, e.observaciones, " +
                "ag_orig.nombre, ag_dest.nombre " +
                "FROM encomiendas e " +
                "LEFT JOIN clientes c1 ON c1.id = e.remitente_id " +
                "LEFT JOIN clientes c2 ON c2.id = e.destinatario_id " +
                "LEFT JOIN agencias ag_orig ON ag_orig.id = e.agencia_origen_id " +
                "LEFT JOIN agencias ag_dest ON ag_dest.id = e.agencia_destino_id " +
                "WHERE (CAST(:ag AS BIGINT) IS NULL OR e.agencia_id = :ag) " +
                "AND e.estado NOT IN ('ENTREGADO','DEVUELTO') " +
                "AND e.fecha_registro < NOW() - INTERVAL '24 hours' " +
                "ORDER BY e.fecha_registro ASC")
                .setParameter("ag", agenciaId).getResultList();
        } catch (Exception ignored) {}

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] r : rows) {
            int horas = r[4] != null ? ((Number) r[4]).intValue() : 0;
            boolean esFragil = r[7] != null && (Boolean) r[7];
            String obs = r[8] != null ? r[8].toString() : "";
            boolean deViajeCancelado = obs.contains("cancelado");

            // Criticidad: CRITICA > 7 días o frágil >48h, ALTA >48h, NORMAL >24h
            String criticidad;
            if (horas >= 168 || (esFragil && horas >= 48)) criticidad = "CRITICA";
            else if (horas >= 48) criticidad = "ALTA";
            else criticidad = "NORMAL";

            java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("id",                ((Number) r[0]).longValue());
            item.put("codigoTracking",    str(r[1]));
            item.put("estado",            str(r[2]));
            item.put("descripcion",       str(r[3]));
            item.put("horas",             horas);
            item.put("remitente",         str(r[5]));
            item.put("destinatario",      str(r[6]));
            item.put("esFragil",          esFragil);
            item.put("criticidad",        criticidad);
            item.put("deViajeCancelado",  deViajeCancelado);
            item.put("agenciaOrigen",     r[9] != null ? str(r[9]) : null);
            item.put("agenciaDestino",    r[10] != null ? str(r[10]) : null);
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
        m.put("encomiendasDelta", delta(encHoy, encAyer));
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

    /** Conductores con viajes activos hoy (PROGRAMADO, EN_RUTA, ATRASADO). */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getConductoresActivos(Long agenciaId) {
        List<Object[]> rows = new ArrayList<>();
        try {
            rows = entityManager.createNativeQuery(
                "SELECT v.id, v.estado, v.fecha_hora_sal, " +
                "r.origen, r.destino, veh.placa, veh.tipo, " +
                "con.nombres || ' ' || con.apellidos, con.licencia, " +
                "(SELECT COUNT(*) FROM asientos a WHERE a.viaje_id = v.id AND a.estado IN ('OCUPADO','RESERVADO')), " +
                "veh.num_asientos " +
                "FROM viajes v " +
                "LEFT JOIN rutas r ON r.id = v.ruta_id " +
                "LEFT JOIN vehiculos veh ON veh.id = v.vehiculo_id " +
                "LEFT JOIN conductores con ON con.id = v.conductor_id " +
                "WHERE v.estado IN ('PROGRAMADO','EN_RUTA','ATRASADO') " +
                "AND (CAST(:ag AS BIGINT) IS NULL OR v.agencia_id = :ag) " +
                "ORDER BY v.fecha_hora_sal ASC")
                .setParameter("ag", agenciaId).getResultList();
        } catch (Exception ignored) {}

        List<Map<String, Object>> result = new ArrayList<>();
        for (Object[] r : rows) {
            int asientosOcupados = r[9] != null ? ((Number) r[9]).intValue() : 0;
            int numAsientos      = r[10] != null ? ((Number) r[10]).intValue() : 1;
            int capacidad        = Math.max(1, numAsientos - 1);

            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("viajeId",          ((Number) r[0]).longValue());
            m.put("estado",           str(r[1]));
            m.put("fechaHoraSal",     r[2]);
            m.put("origen",           str(r[3]));
            m.put("destino",          str(r[4]));
            m.put("placa",            str(r[5]));
            m.put("tipoVehiculo",     str(r[6]));
            m.put("conductorNombre",  str(r[7]));
            m.put("licencia",         str(r[8]));
            m.put("asientosOcupados", asientosOcupados);
            m.put("capacidad",        capacidad);
            m.put("ocupacionPct",     Math.round((asientosOcupados * 100.0) / capacidad));
            result.add(m);
        }
        return result;
    }

    private String str(Object o) { return o != null ? String.valueOf(o) : "—"; }

    private LocalDateTime parseFechaSegura(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            String normalized = s.replace(" ", "T");
            if (normalized.length() > 19) normalized = normalized.substring(0, 19);
            return LocalDateTime.parse(normalized);
        } catch (Exception ignored) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public byte[] generarReporteVentas(LocalDateTime desde, LocalDateTime hasta, Long agenciaId) throws IOException {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        var pasajes = ag != null
                ? pasajeRepository.findByAgenciaIdAndFechaEmisionBetween(ag, desde, hasta)
                : pasajeRepository.findByFechaEmisionBetween(desde, hasta);

        // Batch-load cliente data (evita N+1)
        List<Long> clienteIds = pasajes.stream().map(p -> p.getClienteId())
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String[]> clienteMap = new HashMap<>();
        if (!clienteIds.isEmpty()) {
            try {
                List<Object[]> rows = entityManager.createNativeQuery(
                    "SELECT id, apellidos || ', ' || nombres, tipo_doc, num_doc FROM clientes WHERE id IN :ids")
                    .setParameter("ids", clienteIds).getResultList();
                for (Object[] r : rows) {
                    Long id = ((Number) r[0]).longValue();
                    clienteMap.put(id, new String[]{ str(r[1]), r[2] != null ? r[2].toString() : "", str(r[3]) });
                }
            } catch (Exception ignored) {}
        }

        // Batch-load ruta data via viaje (evita N+1)
        List<Long> viajeIds = pasajes.stream().map(p -> p.getViajeId())
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String> rutaMap = new HashMap<>();
        if (!viajeIds.isEmpty()) {
            try {
                List<Object[]> rows = entityManager.createNativeQuery(
                    "SELECT v.id, r.origen, r.destino FROM viajes v JOIN rutas r ON r.id = v.ruta_id WHERE v.id IN :ids")
                    .setParameter("ids", viajeIds).getResultList();
                for (Object[] r : rows) {
                    Long id = ((Number) r[0]).longValue();
                    rutaMap.put(id, str(r[1]) + " → " + str(r[2]));
                }
            } catch (Exception ignored) {}
        }

        DateTimeFormatter fmtFecha = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        List<Map<String, Object>> datos = pasajes.stream().map(p -> {
            String[] cl = p.getClienteId() != null ? clienteMap.get(p.getClienteId()) : null;
            String pasajero = cl != null ? cl[0] : "—";
            String tipoDoc  = cl != null ? cl[1] : "";
            String numDoc   = cl != null ? cl[2] : "—";
            String dni      = tipoDoc.isBlank() ? numDoc : tipoDoc + ": " + numDoc;
            String ruta     = p.getViajeId() != null ? rutaMap.getOrDefault(p.getViajeId(), "—") : "—";
            String fecha    = p.getFechaEmision() != null ? p.getFechaEmision().format(fmtFecha) : "—";
            String asiento  = p.getAsientoNumero() != null ? String.valueOf(p.getAsientoNumero()) : "—";
            java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("codigo",     p.getCorrelativo() != null ? p.getCorrelativo() : p.getId().toString());
            row.put("fecha",      fecha);
            row.put("pasajero",   pasajero);
            row.put("dni",        dni);
            row.put("ruta",       ruta);
            row.put("asiento",    asiento);
            row.put("precio",     p.getPrecioFinal()    != null ? p.getPrecioFinal().toString()    : "0");
            row.put("descuento",  p.getMontoDescuento() != null ? p.getMontoDescuento().toString() : "0");
            row.put("formaPago",  p.getFormaPago() != null ? p.getFormaPago() : "EFECTIVO");
            row.put("estado",     p.getEstado()    != null ? p.getEstado()    : "—");
            return row;
        }).collect(Collectors.toList());
        return excelGenerator.generarReporteVentas(datos);
    }

    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public byte[] generarReporteEncomiendas(Long agenciaId, String estado, String desde, String hasta) throws IOException {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        java.time.LocalDateTime desdeDate = parseFechaSegura(desde);
        java.time.LocalDateTime hastaDate = parseFechaSegura(hasta);
        var encomiendas = encomiendaService.buscarConFiltros(ag, estado, null, desdeDate, hastaDate, null);

        // Batch-load nombres de clientes (remitente + destinatario) para evitar N+1
        List<Long> personaIds = encomiendas.stream()
                .flatMap(e -> java.util.stream.Stream.of(e.getRemitenteId(), e.getDestinatarioId()))
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String> nombreMap = new HashMap<>();
        if (!personaIds.isEmpty()) {
            try {
                List<Object[]> rows = entityManager.createNativeQuery(
                    "SELECT id, apellidos || ', ' || nombres FROM clientes WHERE id IN :ids")
                    .setParameter("ids", personaIds).getResultList();
                for (Object[] r : rows) {
                    Long id = ((Number) r[0]).longValue();
                    nombreMap.put(id, str(r[1]));
                }
            } catch (Exception ignored) {}
        }

        // Batch-load nombres de agencias (origen + destino)
        List<Long> agenciaIds = encomiendas.stream()
                .flatMap(e -> java.util.stream.Stream.of(e.getAgenciaOrigenId(), e.getAgenciaDestinoId()))
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String> agenciaMap = new HashMap<>();
        if (!agenciaIds.isEmpty()) {
            try {
                List<Object[]> rows = entityManager.createNativeQuery(
                    "SELECT id, nombre FROM agencias WHERE id IN :ids")
                    .setParameter("ids", agenciaIds).getResultList();
                for (Object[] r : rows) {
                    Long id = ((Number) r[0]).longValue();
                    agenciaMap.put(id, str(r[1]));
                }
            } catch (Exception ignored) {}
        }

        DateTimeFormatter fmtFecha = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        List<Map<String, Object>> datos = encomiendas.stream().map(e -> {
            String remitente    = e.getRemitenteId()    != null ? nombreMap.getOrDefault(e.getRemitenteId(),    "—") : "—";
            String destinatario = e.getDestinatarioId() != null ? nombreMap.getOrDefault(e.getDestinatarioId(), "—") : "—";
            String agOrigen     = e.getAgenciaOrigenId()  != null ? agenciaMap.getOrDefault(e.getAgenciaOrigenId(),  "—") : "—";
            String agDestino    = e.getAgenciaDestinoId() != null ? agenciaMap.getOrDefault(e.getAgenciaDestinoId(), "—") : "—";
            String fecha        = e.getFechaRegistro() != null ? e.getFechaRegistro().format(fmtFecha) : "—";
            java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("codigo",       e.getCodigoTracking());
            row.put("fecha",        fecha);
            row.put("estado",       e.getEstado() != null ? e.getEstado() : "—");
            row.put("remitente",    remitente);
            row.put("destinatario", destinatario);
            row.put("agenciaOrigen",  agOrigen);
            row.put("agenciaDestino", agDestino);
            row.put("descripcion",  e.getDescripcion());
            row.put("peso",         e.getPesoKg() != null ? e.getPesoKg().toString() : "0");
            row.put("numBultos",    e.getNumBultos() != null ? e.getNumBultos().toString() : "1");
            row.put("esFragil",     e.isEsFragil() ? "Sí" : "No");
            row.put("formaCobro",   e.getFormaCobro() != null ? e.getFormaCobro() : "EFECTIVO");
            row.put("precio",       e.getPrecioEnvio() != null ? e.getPrecioEnvio().toString() : "0");
            return row;
        }).collect(Collectors.toList());
        return excelGenerator.generarReporteEncomiendas(datos);
    }

    /** Reporte de rendiciones (entregas de efectivo a gerencia) con filtros opcionales. */
    @SuppressWarnings("unchecked")
    @Transactional(readOnly = true)
    public byte[] generarReporteRendiciones(Long agenciaId, String estado, String desde, String hasta) throws IOException {
        Long ag = agenciaId != null ? agenciaId : AgenciaContext.getAgenciaId();
        LocalDateTime desdeDate = parseFechaSegura(desde);
        LocalDateTime hastaDate = parseFechaSegura(hasta);

        var entregas = (ag != null
                ? entregaEfectivoRepository.findByAgenciaIdOrderByFechaEntregaDesc(ag)
                : entregaEfectivoRepository.findAllByOrderByFechaEntregaDesc())
            .stream()
            .filter(e -> estado == null || estado.isBlank() || estado.equals(e.getEstado()))
            .filter(e -> desdeDate == null || !e.getFechaEntrega().isBefore(desdeDate))
            .filter(e -> hastaDate == null || !e.getFechaEntrega().isAfter(hastaDate))
            .collect(Collectors.toList());

        // Batch-load nombres de usuarios (declara + confirma) y agencias, evitando N+1
        List<Long> usuarioIds = entregas.stream()
                .flatMap(e -> java.util.stream.Stream.of(e.getUsuarioEntregaId(), e.getUsuarioConfirmaId()))
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String> usuarioMap = new HashMap<>();
        if (!usuarioIds.isEmpty()) {
            try {
                List<Object[]> rows = entityManager.createNativeQuery(
                    "SELECT id, nombres || ' ' || apellidos FROM usuarios WHERE id IN :ids")
                    .setParameter("ids", usuarioIds).getResultList();
                for (Object[] r : rows) usuarioMap.put(((Number) r[0]).longValue(), str(r[1]));
            } catch (Exception ignored) {}
        }

        List<Long> agenciaIds = entregas.stream().map(e -> e.getAgenciaId())
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String> agenciaMap = new HashMap<>();
        if (!agenciaIds.isEmpty()) {
            try {
                List<Object[]> rows = entityManager.createNativeQuery(
                    "SELECT id, nombre FROM agencias WHERE id IN :ids")
                    .setParameter("ids", agenciaIds).getResultList();
                for (Object[] r : rows) agenciaMap.put(((Number) r[0]).longValue(), str(r[1]));
            } catch (Exception ignored) {}
        }

        DateTimeFormatter fmtFecha = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
        List<Map<String, Object>> datos = entregas.stream().map(e -> {
            java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("numero",       e.getNumero());
            row.put("fecha",        e.getFechaEntrega() != null ? e.getFechaEntrega().format(fmtFecha) : "—");
            row.put("agencia",      agenciaMap.getOrDefault(e.getAgenciaId(), "—"));
            row.put("declaradoPor", usuarioMap.getOrDefault(e.getUsuarioEntregaId(), "—"));
            row.put("modalidad",    "DEPOSITO_BANCARIO".equals(e.getModalidad()) ? "Depósito bancario" : "Entrega directa");
            row.put("nroOperacion", e.getNroOperacion() != null ? e.getNroOperacion() : "");
            row.put("montoDeclarado", e.getMontoDeclarado() != null ? e.getMontoDeclarado().toString() : "0");
            if (e.getMontoConfirmado() != null) row.put("montoConfirmado", e.getMontoConfirmado().toString());
            if (e.getDiferencia() != null)      row.put("diferencia",      e.getDiferencia().toString());
            row.put("estado",        e.getEstado());
            row.put("confirmadoPor", e.getUsuarioConfirmaId() != null
                    ? usuarioMap.getOrDefault(e.getUsuarioConfirmaId(), "—") : "");
            row.put("fechaConfirmacion", e.getFechaConfirmacion() != null
                    ? e.getFechaConfirmacion().format(fmtFecha) : "");
            String obs = e.getObservaciones() != null ? e.getObservaciones() : "";
            if (e.getObsConfirmacion() != null && !e.getObsConfirmacion().isBlank()) {
                obs = obs.isBlank() ? e.getObsConfirmacion() : obs + " | " + e.getObsConfirmacion();
            }
            row.put("observaciones", obs);
            return row;
        }).collect(Collectors.toList());
        return excelGenerator.generarReporteRendiciones(datos);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getTendencia(Long agenciaId, int dias) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM");
        LocalDateTime inicio = LocalDate.now().minusDays(dias - 1L).atStartOfDay();
        LocalDateTime fin    = LocalDate.now().atTime(23, 59, 59);

        // Two batch queries instead of 2×N per-day queries
        Map<LocalDate, long[]> pasajesPorDia = new java.util.TreeMap<>();
        try {
            List<Object[]> rows = entityManager.createNativeQuery(
                "SELECT DATE(fecha_emision), COUNT(*), COALESCE(SUM(precio_final),0) FROM pasajes " +
                "WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) AND estado != 'ANULADO' " +
                "AND fecha_emision BETWEEN :ini AND :fin GROUP BY DATE(fecha_emision)")
                .setParameter("ag", agenciaId).setParameter("ini", inicio).setParameter("fin", fin)
                .getResultList();
            for (Object[] r : rows) {
                LocalDate d = ((java.sql.Date) r[0]).toLocalDate();
                long cnt = ((Number) r[1]).longValue();
                long ing = new BigDecimal(r[2].toString()).multiply(BigDecimal.valueOf(100)).longValue();
                pasajesPorDia.put(d, new long[]{ cnt, ing });
            }
        } catch (Exception ignored) {}

        Map<LocalDate, Long> encomiendaPorDia = new java.util.TreeMap<>();
        try {
            List<Object[]> rows = entityManager.createNativeQuery(
                "SELECT DATE(fecha_registro), COUNT(*) FROM encomiendas " +
                "WHERE (CAST(:ag AS BIGINT) IS NULL OR agencia_id = :ag) " +
                "AND fecha_registro BETWEEN :ini AND :fin GROUP BY DATE(fecha_registro)")
                .setParameter("ag", agenciaId).setParameter("ini", inicio).setParameter("fin", fin)
                .getResultList();
            for (Object[] r : rows) {
                encomiendaPorDia.put(((java.sql.Date) r[0]).toLocalDate(), ((Number) r[1]).longValue());
            }
        } catch (Exception ignored) {}

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (int i = dias - 1; i >= 0; i--) {
            LocalDate fecha = LocalDate.now().minusDays(i);
            long[] pRow = pasajesPorDia.getOrDefault(fecha, new long[]{ 0L, 0L });
            long enc    = encomiendaPorDia.getOrDefault(fecha, 0L);
            Map<String, Object> item = new java.util.LinkedHashMap<>();
            item.put("fecha",       fecha.format(fmt));
            item.put("pasajes",     pRow[0]);
            item.put("encomiendas", enc);
            item.put("ingresos",    pRow[1] / 100.0);
            resultado.add(item);
        }
        return resultado;
    }

    /**
     * Reporte de ingresos altamente filtrable: rango de fechas, agencia, usuario,
     * tipo de vehículo y categoría, con desglose agrupado por la dimensión pedida.
     * Se apoya en las columnas de dimensión de movimientos_caja (migración V5).
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getIngresos(LocalDateTime desde, LocalDateTime hasta,
                                           Long agenciaId, Long usuarioId,
                                           String tipoVehiculo, String categoria,
                                           String groupBy) {

        String filtros = " WHERE mc.tipo = 'INGRESO' AND mc.monto > 0 " +
                "AND mc.created_at BETWEEN :desde AND :hasta " +
                "AND (CAST(:ag  AS BIGINT)  IS NULL OR mc.agencia_id = :ag) " +
                "AND (CAST(:usr AS BIGINT)  IS NULL OR mc.usuario_id = :usr) " +
                "AND (CAST(:tv  AS VARCHAR) IS NULL OR mc.tipo_vehiculo = :tv) " +
                "AND (CAST(:cat AS VARCHAR) IS NULL OR mc.categoria_ingreso = :cat) ";

        // ── Totales por categoría (siempre) ──────────────────────────────────
        Map<String, Map<String, Object>> porCategoria = new java.util.LinkedHashMap<>();
        BigDecimal totalGeneral = BigDecimal.ZERO;
        long operacionesTotal = 0;
        try {
            List<Object[]> rows = entityManager.createNativeQuery(
                    "SELECT COALESCE(mc.categoria_ingreso,'OTRO'), SUM(mc.monto), COUNT(*) " +
                    "FROM movimientos_caja mc" + filtros +
                    "GROUP BY 1 ORDER BY 2 DESC")
                    .setParameter("desde", desde).setParameter("hasta", hasta)
                    .setParameter("ag", agenciaId).setParameter("usr", usuarioId)
                    .setParameter("tv", tipoVehiculo).setParameter("cat", categoria)
                    .getResultList();
            for (Object[] r : rows) {
                BigDecimal monto = r[1] != null ? new BigDecimal(r[1].toString()) : BigDecimal.ZERO;
                long ops = ((Number) r[2]).longValue();
                Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("total", monto);
                item.put("operaciones", ops);
                porCategoria.put(String.valueOf(r[0]), item);
                totalGeneral = totalGeneral.add(monto);
                operacionesTotal += ops;
            }
        } catch (Exception ignored) {}

        // ── Desglose por la dimensión pedida (whitelist contra SQL injection) ─
        String groupExpr, labelExpr, joins;
        switch (groupBy == null ? "categoria" : groupBy) {
            case "dia" -> {
                groupExpr = "DATE(mc.created_at)";
                labelExpr = "TO_CHAR(DATE(mc.created_at), 'DD/MM/YYYY')";
                joins = "";
            }
            case "agencia" -> {
                groupExpr = "mc.agencia_id";
                labelExpr = "MAX(COALESCE(ag.nombre, 'Agencia ' || mc.agencia_id))";
                joins = "LEFT JOIN agencias ag ON ag.id = mc.agencia_id ";
            }
            case "usuario" -> {
                groupExpr = "mc.usuario_id";
                labelExpr = "MAX(COALESCE(TRIM(u.nombres || ' ' || COALESCE(u.apellidos,'')), 'Usuario ' || mc.usuario_id))";
                joins = "LEFT JOIN usuarios u ON u.id = mc.usuario_id ";
            }
            case "vehiculo" -> {
                groupExpr = "mc.vehiculo_id";
                labelExpr = "MAX(COALESCE(v.placa || ' (' || v.tipo || ')', 'Sin vehiculo'))";
                joins = "LEFT JOIN vehiculos v ON v.id = mc.vehiculo_id ";
            }
            case "conductor" -> {
                groupExpr = "mc.conductor_id";
                labelExpr = "MAX(COALESCE(" +
                        "NULLIF(TRIM(COALESCE(cd.nombres,'') || ' ' || COALESCE(cd.apellidos,'')), ''), " +
                        "NULLIF(TRIM(COALESCE(uc.nombres,'') || ' ' || COALESCE(uc.apellidos,'')), ''), " +
                        "'Sin conductor'))";
                joins = "LEFT JOIN conductores cd ON cd.id = mc.conductor_id " +
                        "LEFT JOIN usuarios uc ON uc.id = mc.conductor_id ";
            }
            case "viaje" -> {
                groupExpr = "mc.viaje_id";
                labelExpr = "CASE WHEN mc.viaje_id IS NULL THEN 'Sin viaje' ELSE 'Viaje ' || mc.viaje_id END";
                joins = "";
            }
            default -> {
                groupExpr = "COALESCE(mc.categoria_ingreso,'OTRO')";
                labelExpr = groupExpr;
                joins = "";
            }
        }

        List<Map<String, Object>> desglose = new ArrayList<>();
        try {
            List<Object[]> rows = entityManager.createNativeQuery(
                    "SELECT " + groupExpr + " AS clave, " + labelExpr + " AS etiqueta, " +
                    "COUNT(*) AS operaciones, SUM(mc.monto) AS total " +
                    "FROM movimientos_caja mc " + joins + filtros +
                    "GROUP BY " + groupExpr + " ORDER BY total DESC LIMIT 200")
                    .setParameter("desde", desde).setParameter("hasta", hasta)
                    .setParameter("ag", agenciaId).setParameter("usr", usuarioId)
                    .setParameter("tv", tipoVehiculo).setParameter("cat", categoria)
                    .getResultList();
            for (Object[] r : rows) {
                Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("clave",       r[0] != null ? r[0].toString() : null);
                item.put("etiqueta",    r[1] != null ? r[1].toString() : "—");
                item.put("operaciones", ((Number) r[2]).longValue());
                item.put("total",       r[3] != null ? new BigDecimal(r[3].toString()) : BigDecimal.ZERO);
                desglose.add(item);
            }
        } catch (Exception ignored) {}

        Map<String, Object> resp = new java.util.LinkedHashMap<>();
        resp.put("totalGeneral",     totalGeneral);
        resp.put("operacionesTotal", operacionesTotal);
        resp.put("porCategoria",     porCategoria);
        resp.put("groupBy",          groupBy == null ? "categoria" : groupBy);
        resp.put("desglose",         desglose);
        return resp;
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
