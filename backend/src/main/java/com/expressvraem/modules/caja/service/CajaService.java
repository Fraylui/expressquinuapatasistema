package com.expressvraem.modules.caja.service;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.caja.entity.Caja;
import com.expressvraem.modules.caja.entity.MovimientoCaja;
import com.expressvraem.modules.caja.repository.CajaRepository;
import com.expressvraem.modules.caja.repository.MovimientoCajaRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.expressvraem.shared.websocket.WebSocketEventPublisher;
import com.expressvraem.shared.websocket.dto.MovimientoCajaDTO;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class CajaService {

    private final CajaRepository cajaRepository;
    private final MovimientoCajaRepository movimientoRepository;
    private final WebSocketEventPublisher wsPublisher;
    private final EntityManager entityManager;
    private final AuditoriaService auditoriaService;

    private record TipoStat(long count, BigDecimal sum) {
        static final TipoStat ZERO = new TipoStat(0L, BigDecimal.ZERO);
    }

    private Map<String, TipoStat> loadStats(Long cajaId) {
        Map<String, TipoStat> stats = new HashMap<>();
        movimientoRepository.aggregateStatsByCajaId(cajaId).forEach(row -> {
            String tipo = row[0] != null ? (String) row[0] : "__MANUAL__";
            long count  = ((Number) row[1]).longValue();
            BigDecimal sum = row[2] instanceof BigDecimal bd ? bd : BigDecimal.ZERO;
            stats.put(tipo, new TipoStat(count, sum));
        });
        return stats;
    }

    private Map<Long, Map<String, TipoStat>> batchStats(List<Long> cajaIds) {
        Map<Long, Map<String, TipoStat>> result = new HashMap<>();
        if (cajaIds.isEmpty()) return result;
        movimientoRepository.aggregateStatsByCajaIdIn(cajaIds).forEach(row -> {
            Long cajaId  = ((Number) row[0]).longValue();
            String tipo  = row[1] != null ? (String) row[1] : "__MANUAL__";
            long count   = ((Number) row[2]).longValue();
            BigDecimal sum = row[3] instanceof BigDecimal bd ? bd : BigDecimal.ZERO;
            result.computeIfAbsent(cajaId, k -> new HashMap<>())
                  .put(tipo, new TipoStat(count, sum));
        });
        return result;
    }

    @Transactional
    public Caja abrirCaja(Long usuarioId, BigDecimal montoInicial, Long agenciaIdOverride,
                          String ip, String usuarioNombre) {
        Long agenciaId = agenciaIdOverride != null ? agenciaIdOverride : AgenciaContext.getAgenciaId();
        if (agenciaId == null) throw new BusinessException(
                "No se pudo determinar la agencia del operador", "AGENCIA_REQUERIDA");

        if (cajaRepository.existsByUsuarioIdAndEstado(usuarioId, "ABIERTA")) {
            throw new BusinessException("Ya tiene un turno abierto", "CAJA_YA_ABIERTA");
        }
        if (montoInicial == null || montoInicial.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("El monto inicial debe ser mayor o igual a cero", "MONTO_INVALIDO");
        }

        Caja caja = Caja.builder()
                .agenciaId(agenciaId)
                .usuarioId(usuarioId)
                .fechaApertura(LocalDateTime.now())
                .montoApertura(montoInicial)
                .totalIngresos(BigDecimal.ZERO)
                .totalEgresos(BigDecimal.ZERO)
                .estado("ABIERTA")
                .build();

        Caja saved = cajaRepository.save(caja);
        log.info("Turno abierto: cajaId={} usuarioId={} monto={}", saved.getId(), usuarioId, montoInicial);

        auditoriaService.registrar(Auditoria.builder()
                .usuarioId(usuarioId).usuarioNombre(usuarioNombre)
                .agenciaId(agenciaId).accion("INSERT").modulo("CAJA").entidad("TURNO")
                .registroId(saved.getId())
                .datosDespues("apertura montoInicial=" + montoInicial.toPlainString())
                .ip(ip).build());

        return saved;
    }

    @Transactional
    public MovimientoCaja registrarMovimiento(Long cajaId, String tipo, String concepto,
                                              BigDecimal monto, Long usuarioId,
                                              String referenciaTipo, Long referenciaId) {
        Caja caja = cajaRepository.findByIdForUpdate(cajaId)
                .orElseThrow(() -> new ResourceNotFoundException("Caja", cajaId));

        if (!"ABIERTA".equals(caja.getEstado())) {
            throw new BusinessException("La caja no está abierta", "CAJA_CERRADA");
        }

        boolean esIngreso = "INGRESO".equals(tipo);
        if (esIngreso) {
            caja.setTotalIngresos(caja.getTotalIngresos().add(monto));
        } else {
            caja.setTotalEgresos(caja.getTotalEgresos().add(monto));
        }
        cajaRepository.save(caja);

        BigDecimal saldo = caja.getMontoApertura()
                .add(caja.getTotalIngresos())
                .subtract(caja.getTotalEgresos());

        MovimientoCaja mov = MovimientoCaja.builder()
                .agenciaId(caja.getAgenciaId())
                .cajaId(cajaId)
                .usuarioId(usuarioId)
                .tipo(tipo)
                .concepto(concepto)
                .monto(monto)
                .saldoAcumulado(saldo)
                .referenciaTipo(referenciaTipo)
                .referenciaId(referenciaId)
                .build();

        MovimientoCaja saved = movimientoRepository.save(mov);

        wsPublisher.publicarMovimientoCaja(cajaId, new MovimientoCajaDTO(
                cajaId, saved.getId(), tipo, referenciaTipo, concepto, monto, saldo,
                caja.getTotalIngresos(), caja.getTotalEgresos(), caja.getMontoApertura(),
                LocalDateTime.now()));

        return saved;
    }


    public void verificarOwnership(Long cajaId, Long usuarioId) {
        Caja caja = cajaRepository.findById(cajaId)
                .orElseThrow(() -> new ResourceNotFoundException("Caja", cajaId));
        if (!caja.getUsuarioId().equals(usuarioId)) {
            throw new BusinessException("No tiene permiso sobre esta caja", "ACCESO_DENEGADO");
        }
    }


    @Transactional
    public MovimientoCaja registrarEgreso(Long usuarioId, String concepto, BigDecimal monto,
                                          String ip, String usuarioNombre) {
        Caja caja = cajaRepository.findByUsuarioIdAndEstado(usuarioId, "ABIERTA")
                .orElseThrow(() -> new BusinessException("No tiene turno activo", "SIN_TURNO_ACTIVO"));
        if (monto == null || monto.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("El monto del egreso debe ser mayor que cero", "MONTO_INVALIDO");
        }
        MovimientoCaja mov = registrarMovimiento(caja.getId(), "EGRESO", concepto, monto, usuarioId, null, null);

        auditoriaService.registrar(Auditoria.builder()
                .usuarioId(usuarioId).usuarioNombre(usuarioNombre)
                .agenciaId(caja.getAgenciaId()).accion("INSERT").modulo("CAJA").entidad("EGRESO")
                .registroId(mov.getId())
                .datosDespues("concepto=" + concepto + " monto=" + monto.toPlainString())
                .ip(ip).build());

        return mov;
    }


    @Transactional
    public MovimientoCaja registrarIngreso(Long usuarioId, String concepto, BigDecimal monto,
                                           String ip, String usuarioNombre) {
        Caja caja = cajaRepository.findByUsuarioIdAndEstado(usuarioId, "ABIERTA")
                .orElseThrow(() -> new BusinessException("No tiene turno activo", "SIN_TURNO_ACTIVO"));
        if (monto == null || monto.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("El monto del ingreso debe ser mayor que cero", "MONTO_INVALIDO");
        }
        MovimientoCaja mov = registrarMovimiento(caja.getId(), "INGRESO", concepto, monto, usuarioId, null, null);

        auditoriaService.registrar(Auditoria.builder()
                .usuarioId(usuarioId).usuarioNombre(usuarioNombre)
                .agenciaId(caja.getAgenciaId()).accion("INSERT").modulo("CAJA").entidad("INGRESO")
                .registroId(mov.getId())
                .datosDespues("concepto=" + concepto + " monto=" + monto.toPlainString())
                .ip(ip).build());

        return mov;
    }


    @Transactional
    public Caja cerrarTurno(Long usuarioId, BigDecimal montoFisico, String observacion,
                            String ip, String usuarioNombre) {
        Caja caja = cajaRepository.findByUsuarioIdAndEstado(usuarioId, "ABIERTA")
                .orElseThrow(() -> new BusinessException("No tiene turno activo", "SIN_TURNO_ACTIVO"));

        BigDecimal saldoSistema = caja.getMontoApertura()
                .add(caja.getTotalIngresos())
                .subtract(caja.getTotalEgresos());
        BigDecimal diferencia = montoFisico.subtract(saldoSistema);

        caja.setMontoCierre(montoFisico);
        caja.setDiferencia(diferencia);
        caja.setEstado("CERRADA");
        caja.setFechaCierre(LocalDateTime.now());
        caja.setObservaciones(observacion);

        Caja saved = cajaRepository.save(caja);
        log.info("Turno cerrado: cajaId={} diferencia={}", saved.getId(), diferencia);

        String estadoCuadre = diferencia.compareTo(BigDecimal.ZERO) == 0
                ? "CUADRA"
                : (diferencia.compareTo(BigDecimal.ZERO) > 0 ? "SOBRA" : "FALTA")
                  + " S/" + diferencia.abs().toPlainString();

        auditoriaService.registrar(Auditoria.builder()
                .usuarioId(usuarioId).usuarioNombre(usuarioNombre)
                .agenciaId(caja.getAgenciaId()).accion("UPDATE").modulo("CAJA").entidad("TURNO")
                .registroId(saved.getId())
                .datosAntes("estado=ABIERTA saldoSistema=" + saldoSistema.toPlainString())
                .datosDespues("estado=CERRADA montoFisico=" + montoFisico.toPlainString()
                        + " diferencia=" + diferencia.toPlainString() + " cuadre=" + estadoCuadre)
                .ip(ip).build());

        return saved;
    }


    public Map<String, Object> getTurnoActualEnriquecido(Long usuarioId) {
        Caja caja = cajaRepository.findByUsuarioIdAndEstado(usuarioId, "ABIERTA")
                .orElseThrow(() -> new BusinessException("No tiene turno activo", "SIN_TURNO_ACTIVO"));
        return enrichCaja(caja);
    }

    public Caja getTurnoActual(Long usuarioId) {
        return cajaRepository.findByUsuarioIdAndEstado(usuarioId, "ABIERTA")
                .orElseThrow(() -> new BusinessException("No tiene turno activo", "SIN_TURNO_ACTIVO"));
    }


    public List<MovimientoCaja> getMovimientosActual(Long usuarioId) {
        Caja caja = cajaRepository.findByUsuarioIdAndEstado(usuarioId, "ABIERTA")
                .orElseThrow(() -> new BusinessException("No tiene turno activo", "SIN_TURNO_ACTIVO"));
        return movimientoRepository.findByCajaIdOrderByCreatedAtDesc(caja.getId());
    }

    public List<MovimientoCaja> getMovimientos(Long cajaId) {
        return movimientoRepository.findByCajaIdOrderByCreatedAtDesc(cajaId);
    }


    public List<Map<String, Object>> getHistorial(Long usuarioId, String rol,
                                                   Long filtroAgencia, Long filtroUsuario,
                                                   int page) {
        PageRequest pr = PageRequest.of(page, 30);
        Page<Caja> cajas;

        if ("SUPER_ADMIN".equals(rol) || "GERENTE".equals(rol)) {
            if (filtroAgencia != null) {
                cajas = cajaRepository.findByAgenciaIdOrderByFechaAperturaDesc(filtroAgencia, pr);
            } else {
                cajas = cajaRepository.findAllByOrderByFechaAperturaDesc(pr);
            }
        } else if ("ADMIN_AGENCIA".equals(rol)) {
            cajas = cajaRepository.findByAgenciaIdOrderByFechaAperturaDesc(filtroAgencia, pr);
        } else {
            cajas = cajaRepository.findByUsuarioIdOrderByFechaAperturaDesc(
                    filtroUsuario != null ? filtroUsuario : usuarioId, pr);
        }

        return enrichCajaList(cajas.getContent());
    }


    public Map<String, Object> getResumenTurno(Long cajaId) {
        Caja caja = cajaRepository.findById(cajaId)
                .orElseThrow(() -> new ResourceNotFoundException("Caja", cajaId));
        return enrichCaja(caja);
    }


    private Map<String, Object> enrichCaja(Caja caja) {
        Map<String, TipoStat> stats = loadStats(caja.getId());
        return buildMap(caja, stats, resolveNombreUsuario(caja.getUsuarioId()), resolveNombreAgencia(caja.getAgenciaId()));
    }

    private List<Map<String, Object>> enrichCajaList(List<Caja> cajas) {
        if (cajas.isEmpty()) return List.of();

        List<Long> cajaIds    = cajas.stream().map(Caja::getId).toList();
        List<Long> usuarioIds = cajas.stream().map(Caja::getUsuarioId).distinct().toList();
        List<Long> agenciaIds = cajas.stream().map(Caja::getAgenciaId).distinct().toList();

        Map<Long, Map<String, TipoStat>> statsMap = batchStats(cajaIds);

        Map<Long, String> operadores = new HashMap<>();
        try {
            @SuppressWarnings("unchecked")
            List<Object[]> rowsUsr = (List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, nombres, apellidos FROM usuarios WHERE id IN :ids")
                    .setParameter("ids", usuarioIds).getResultList();
            rowsUsr.forEach(row ->
                    operadores.put(((Number) row[0]).longValue(), row[1] + " " + row[2]));
        } catch (Exception e) {
            log.warn("Batch usuarios fallido: {}", e.getMessage());
        }

        Map<Long, String> agencias = new HashMap<>();
        try {
            @SuppressWarnings("unchecked")
            List<Object[]> rowsAg = (List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, nombre, ciudad FROM agencias WHERE id IN :ids")
                    .setParameter("ids", agenciaIds).getResultList();
            rowsAg.forEach(row ->
                    agencias.put(((Number) row[0]).longValue(), row[1] + " — " + row[2]));
        } catch (Exception e) {
            log.warn("Batch agencias fallido: {}", e.getMessage());
        }

        return cajas.stream()
                .map(c -> buildMap(
                        c,
                        statsMap.getOrDefault(c.getId(), Map.of()),
                        operadores.getOrDefault(c.getUsuarioId(), "—"),
                        agencias.getOrDefault(c.getAgenciaId(), "—")))
                .toList();
    }

    private Map<String, Object> buildMap(Caja caja, Map<String, TipoStat> stats,
                                          String operadorNombre, String agenciaNombre) {
        TipoStat stPasajes    = stats.getOrDefault("PASAJE",       TipoStat.ZERO);
        TipoStat stEnc        = stats.getOrDefault("ENCOMIENDA",   TipoStat.ZERO);
        TipoStat stPagoDest   = stats.getOrDefault("PAGO_DESTINO", TipoStat.ZERO);

        BigDecimal saldo = caja.getMontoApertura()
                .add(caja.getTotalIngresos())
                .subtract(caja.getTotalEgresos());

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",             caja.getId());
        m.put("agenciaId",      caja.getAgenciaId());
        m.put("usuarioId",      caja.getUsuarioId());
        m.put("fechaApertura",  caja.getFechaApertura());
        m.put("fechaCierre",    caja.getFechaCierre());
        m.put("montoApertura",  caja.getMontoApertura());
        m.put("totalIngresos",  caja.getTotalIngresos());
        m.put("totalEgresos",   caja.getTotalEgresos());
        m.put("montoCierre",    caja.getMontoCierre());
        m.put("diferencia",     caja.getDiferencia());
        m.put("estado",         caja.getEstado());
        m.put("observaciones",  caja.getObservaciones());
        m.put("saldoActual",    saldo);
        m.put("operadorNombre", operadorNombre);
        m.put("agenciaNombre",  agenciaNombre);
        m.put("cantPasajes",       stPasajes.count());
        m.put("montoPasajes",      stPasajes.sum());
        m.put("cantEncomiendas",   stEnc.count());
        m.put("montoEncomiendas",  stEnc.sum());
        m.put("cantPagoDestino",   stPagoDest.count());
        m.put("montoPagoDestino",  stPagoDest.sum());
        return m;
    }

    @SuppressWarnings("unchecked")
    private String resolveNombreUsuario(Long id) {
        try {
            Object[] row = (Object[]) entityManager
                    .createNativeQuery("SELECT nombres, apellidos FROM usuarios WHERE id = :id")
                    .setParameter("id", id).getSingleResult();
            return row[0] + " " + row[1];
        } catch (Exception e) {
            log.warn("No se pudo resolver operador {}: {}", id, e.getMessage());
            return "—";
        }
    }

    @SuppressWarnings("unchecked")
    private String resolveNombreAgencia(Long id) {
        try {
            Object[] row = (Object[]) entityManager
                    .createNativeQuery("SELECT nombre, ciudad FROM agencias WHERE id = :id")
                    .setParameter("id", id).getSingleResult();
            return row[0] + " — " + row[1];
        } catch (Exception e) {
            log.warn("No se pudo resolver agencia {}: {}", id, e.getMessage());
            return "—";
        }
    }
}
