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

    /** Agencia del turno ABIERTO del usuario, o null si no tiene turno. */
    public Long getAgenciaTurnoAbierto(Long usuarioId) {
        return cajaRepository.findByUsuarioIdAndEstado(usuarioId, "ABIERTA")
                .map(Caja::getAgenciaId).orElse(null);
    }

    @Transactional
    public Caja abrirCaja(Long usuarioId, BigDecimal montoInicial, Long agenciaIdOverride,
                          String ip, String usuarioNombre) {
        Long agenciaId = agenciaIdOverride != null ? agenciaIdOverride : AgenciaContext.getAgenciaId();
        if (agenciaId == null) throw new BusinessException(
                "No se pudo determinar la agencia del operador", "AGENCIA_REQUERIDA");

        // La agencia elegida (p.ej. por el gerente al viajar) debe existir y estar activa
        List<?> ag = entityManager
                .createNativeQuery("SELECT activo FROM agencias WHERE id = :id")
                .setParameter("id", agenciaId).getResultList();
        if (ag.isEmpty()) {
            throw new BusinessException("La agencia seleccionada no existe", "AGENCIA_INVALIDA");
        }
        if (Boolean.FALSE.equals(ag.get(0))) {
            throw new BusinessException("La agencia seleccionada está inactiva", "AGENCIA_INVALIDA");
        }

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
        return registrarMovimiento(cajaId, tipo, concepto, monto, usuarioId,
                referenciaTipo, referenciaId, null, null, null, null, null);
    }

    /** Variante con dimensiones de ingreso para la contabilidad separada por servicio/vehículo/conductor. */
    @Transactional
    public MovimientoCaja registrarMovimiento(Long cajaId, String tipo, String concepto,
                                              BigDecimal monto, Long usuarioId,
                                              String referenciaTipo, Long referenciaId,
                                              String categoriaIngreso, Long viajeId,
                                              Long vehiculoId, String tipoVehiculo, Long conductorId) {
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

        // Derivar la categoría desde la referencia si el llamador no la especifica
        if (categoriaIngreso == null && esIngreso) {
            categoriaIngreso = switch (referenciaTipo == null ? "" : referenciaTipo) {
                case "PASAJE"       -> "PASAJE";
                case "ENCOMIENDA"   -> "ENCOMIENDA";
                case "PAGO_DESTINO" -> "ENC_PAGO_DESTINO";
                case "ENC_EXTERNA"  -> "ENC_EXTERNA";
                default             -> "OTRO";
            };
        }

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
                .categoriaIngreso(categoriaIngreso)
                .viajeId(viajeId)
                .vehiculoId(vehiculoId)
                .tipoVehiculo(tipoVehiculo)
                .conductorId(conductorId)
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

    /**
     * Scope por rol: SUPER_ADMIN/GERENTE ven todo, ADMIN_AGENCIA solo cajas de su
     * agencia, el resto solo sus propias cajas.
     */
    public void verificarAcceso(Long cajaId, Long usuarioId, String rol, Long agenciaId) {
        if ("SUPER_ADMIN".equals(rol) || "GERENTE".equals(rol)) return;
        Caja caja = cajaRepository.findById(cajaId)
                .orElseThrow(() -> new ResourceNotFoundException("Caja", cajaId));
        if ("ADMIN_AGENCIA".equals(rol)) {
            if (agenciaId == null || !agenciaId.equals(caja.getAgenciaId())) {
                throw new BusinessException("No tiene permiso sobre esta caja", "ACCESO_DENEGADO");
            }
            return;
        }
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
        BigDecimal saldo = caja.getMontoApertura()
                .add(caja.getTotalIngresos())
                .subtract(caja.getTotalEgresos());
        if (monto.compareTo(saldo) > 0) {
            throw new BusinessException(
                "Saldo insuficiente. Saldo actual: S/" + saldo.toPlainString(), "SALDO_INSUFICIENTE");
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
            // OPERADOR/CONDUCTOR: siempre sus propias cajas — el filtro ?usuario=X
            // permitía espiar los turnos de caja de cualquier otro usuario
            cajas = cajaRepository.findByUsuarioIdOrderByFechaAperturaDesc(usuarioId, pr);
        }

        return enrichCajaList(cajas.getContent());
    }


    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getEstadoOperadores(Long agenciaId) {
        if (agenciaId == null) return List.of();

        // Todos los operadores activos de la agencia
        List<Object[]> operadores = (List<Object[]>) entityManager.createNativeQuery(
                "SELECT id, nombres, apellidos FROM usuarios " +
                "WHERE agencia_id = :agId AND rol IN ('OPERADOR','ADMIN_AGENCIA') AND activo = true " +
                "ORDER BY nombres")
                .setParameter("agId", agenciaId)
                .getResultList();

        // Cajas abiertas hoy
        List<Caja> abiertas = cajaRepository.findByAgenciaIdAndEstado(agenciaId, "ABIERTA");
        java.util.Set<Long> usuariosConCaja = abiertas.stream()
                .map(Caja::getUsuarioId).collect(java.util.stream.Collectors.toSet());

        return operadores.stream().map(r -> {
            Long uid     = ((Number) r[0]).longValue();
            String nombre = r[1] + " " + r[2];
            boolean tieneCaja = usuariosConCaja.contains(uid);

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("usuarioId",  uid);
            m.put("nombre",     nombre);
            m.put("tieneCaja",  tieneCaja);
            if (tieneCaja) {
                abiertas.stream().filter(c -> uid.equals(c.getUsuarioId())).findFirst()
                        .ifPresent(c -> {
                            m.put("cajaId",        c.getId());
                            m.put("fechaApertura", c.getFechaApertura());
                            m.put("saldoActual",   c.getMontoApertura()
                                    .add(c.getTotalIngresos())
                                    .subtract(c.getTotalEgresos()));
                        });
            }
            return m;
        }).toList();
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getConsolidadoPorAgencia() {
        List<Caja> abiertas = cajaRepository.findByEstado("ABIERTA");
        if (abiertas.isEmpty()) return List.of();

        List<Long> cajaIds    = abiertas.stream().map(Caja::getId).toList();
        List<Long> agenciaIds = abiertas.stream().map(Caja::getAgenciaId).distinct().toList();

        // Nombres de agencias
        Map<Long, String> agencias = new HashMap<>();
        try {
            ((List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, nombre, ciudad FROM agencias WHERE id IN :ids")
                    .setParameter("ids", agenciaIds).getResultList())
                    .forEach(r -> agencias.put(((Number) r[0]).longValue(), r[1] + " — " + r[2]));
        } catch (Exception e) { log.warn("Batch agencias: {}", e.getMessage()); }

        // Stats por tipo de movimiento por caja
        Map<Long, Map<String, TipoStat>> statsMap = batchStats(cajaIds);

        // Agrupar por agencia
        Map<Long, List<Caja>> porAgencia = new java.util.LinkedHashMap<>();
        agenciaIds.forEach(aid -> porAgencia.put(aid, new java.util.ArrayList<>()));
        abiertas.forEach(c -> porAgencia.computeIfAbsent(c.getAgenciaId(), k -> new java.util.ArrayList<>()).add(c));

        List<Map<String, Object>> resultado = new java.util.ArrayList<>();
        BigDecimal totalEmpresaIngresos = BigDecimal.ZERO;
        BigDecimal totalEmpresaSaldo    = BigDecimal.ZERO;
        int        totalTurnos          = 0;

        for (Map.Entry<Long, List<Caja>> entry : porAgencia.entrySet()) {
            Long agId = entry.getKey();
            List<Caja> cajas = entry.getValue();
            if (cajas.isEmpty()) continue;

            BigDecimal sumIngresos  = BigDecimal.ZERO;
            BigDecimal sumEgresos   = BigDecimal.ZERO;
            BigDecimal sumApertura  = BigDecimal.ZERO;
            BigDecimal sumPasajes   = BigDecimal.ZERO;
            BigDecimal sumEnc       = BigDecimal.ZERO;
            BigDecimal sumDestino   = BigDecimal.ZERO;
            BigDecimal sumExternas  = BigDecimal.ZERO;
            BigDecimal sumCuotas    = BigDecimal.ZERO;
            long       cntPasajes   = 0, cntEnc = 0, cntDestino = 0, cntExternas = 0, cntCuotas = 0;

            for (Caja c : cajas) {
                sumIngresos = sumIngresos.add(c.getTotalIngresos());
                sumEgresos  = sumEgresos.add(c.getTotalEgresos());
                sumApertura = sumApertura.add(c.getMontoApertura());
                Map<String, TipoStat> st = statsMap.getOrDefault(c.getId(), Map.of());
                TipoStat stP = st.getOrDefault("PASAJE",       TipoStat.ZERO);
                TipoStat stE = st.getOrDefault("ENCOMIENDA",   TipoStat.ZERO);
                TipoStat stD = st.getOrDefault("PAGO_DESTINO", TipoStat.ZERO);
                TipoStat stX = st.getOrDefault("ENC_EXTERNA",  TipoStat.ZERO);
                TipoStat stC = st.getOrDefault("CUOTA_SALIDA_COMBI", TipoStat.ZERO);
                sumPasajes  = sumPasajes.add(stP.sum());
                sumEnc      = sumEnc.add(stE.sum());
                sumDestino  = sumDestino.add(stD.sum());
                sumExternas = sumExternas.add(stX.sum());
                sumCuotas   = sumCuotas.add(stC.sum());
                cntPasajes += stP.count();
                cntEnc     += stE.count();
                cntDestino += stD.count();
                cntExternas += stX.count();
                cntCuotas   += stC.count();
            }

            BigDecimal saldo = sumApertura.add(sumIngresos).subtract(sumEgresos);
            totalEmpresaIngresos = totalEmpresaIngresos.add(sumIngresos);
            totalEmpresaSaldo    = totalEmpresaSaldo.add(saldo);
            totalTurnos         += cajas.size();

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("agenciaId",      agId);
            m.put("agenciaNombre",  agencias.getOrDefault(agId, "Agencia " + agId));
            m.put("turnosAbiertos", cajas.size());
            m.put("totalIngresos",  sumIngresos);
            m.put("totalEgresos",   sumEgresos);
            m.put("saldoActual",    saldo);
            m.put("montoPasajes",   sumPasajes);
            m.put("cantPasajes",    cntPasajes);
            m.put("montoEncomiendas", sumEnc);
            m.put("cantEncomiendas",  cntEnc);
            m.put("montoPagoDestino", sumDestino);
            m.put("cantPagoDestino",  cntDestino);
            m.put("montoExternas",    sumExternas);
            m.put("cantExternas",     cntExternas);
            m.put("montoCuotasCombi", sumCuotas);
            m.put("cantCuotasCombi",  cntCuotas);
            resultado.add(m);
        }

        // Fila totales empresa al final
        Map<String, Object> totales = new LinkedHashMap<>();
        totales.put("agenciaId",      null);
        totales.put("agenciaNombre",  "__TOTAL__");
        totales.put("turnosAbiertos", totalTurnos);
        totales.put("totalIngresos",  totalEmpresaIngresos);
        totales.put("saldoActual",    totalEmpresaSaldo);
        resultado.add(totales);

        return resultado;
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
        TipoStat stExterna    = stats.getOrDefault("ENC_EXTERNA",  TipoStat.ZERO);
        TipoStat stCuotaCombi = stats.getOrDefault("CUOTA_SALIDA_COMBI", TipoStat.ZERO);

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
        m.put("cantExternas",      stExterna.count());
        m.put("montoExternas",     stExterna.sum());
        m.put("cantCuotasCombi",   stCuotaCombi.count());
        m.put("montoCuotasCombi",  stCuotaCombi.sum());
        return m;
    }

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
