package com.expressvraem.modules.caja.service;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.caja.entity.EntregaEfectivo;
import com.expressvraem.modules.caja.repository.CajaRepository;
import com.expressvraem.modules.caja.repository.EntregaEfectivoRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.utils.SecuenciaService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Rendiciones: entregas periódicas del efectivo acumulado en cada agencia
 * hacia gerencia, con confirmación en dos pasos y trazabilidad completa.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EntregaEfectivoService {

    private final EntregaEfectivoRepository entregaRepository;
    private final CajaRepository cajaRepository;
    private final AuditoriaService auditoriaService;
    private final EntityManager entityManager;
    private final SecuenciaService secuenciaService;

    /** Días sin rendir a partir de los cuales la agencia se marca en alerta. */
    private static final int DIAS_ALERTA = 7;
    /** Monto acumulado a partir del cual la agencia se marca en alerta. */
    private static final BigDecimal MONTO_ALERTA = new BigDecimal("1500");

    // ── Declarar entrega (agencia) ───────────────────────────────────────────

    @Transactional
    public EntregaEfectivo declarar(Long agenciaId, Long usuarioId, BigDecimal monto,
                                    String modalidad, String nroOperacion, String observaciones,
                                    String ip, String usuarioNombre) {
        if (agenciaId == null) {
            throw new BusinessException("No se pudo determinar la agencia", "AGENCIA_REQUERIDA");
        }
        if (monto == null || monto.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("El monto a entregar debe ser mayor que cero", "MONTO_INVALIDO");
        }
        if (!"ENTREGA_DIRECTA".equals(modalidad) && !"DEPOSITO_BANCARIO".equals(modalidad)) {
            throw new BusinessException("Modalidad inválida", "MODALIDAD_INVALIDA");
        }
        if ("DEPOSITO_BANCARIO".equals(modalidad) && (nroOperacion == null || nroOperacion.isBlank())) {
            throw new BusinessException(
                "El número de operación es obligatorio para depósito bancario", "NRO_OPERACION_REQUERIDO");
        }

        EntregaEfectivo entrega = EntregaEfectivo.builder()
                .agenciaId(agenciaId)
                .usuarioEntregaId(usuarioId)
                .numero(generarNumero(agenciaId))
                .modalidad(modalidad)
                .nroOperacion(nroOperacion)
                .montoDeclarado(monto)
                .estado("PENDIENTE")
                .observaciones(observaciones)
                .fechaEntrega(LocalDateTime.now())
                .build();

        EntregaEfectivo saved = entregaRepository.save(entrega);
        log.info("Entrega de efectivo declarada: id={} agencia={} monto={}", saved.getId(), agenciaId, monto);

        auditoriaService.registrar(Auditoria.builder()
                .usuarioId(usuarioId).usuarioNombre(usuarioNombre)
                .agenciaId(agenciaId).accion("INSERT").modulo("CAJA").entidad("ENTREGA_EFECTIVO")
                .registroId(saved.getId())
                .datosDespues("numero=" + saved.getNumero() + " modalidad=" + modalidad
                        + " montoDeclarado=" + monto.toPlainString())
                .ip(ip).build());

        return saved;
    }

    // ── Confirmar recepción (gerencia) ───────────────────────────────────────

    @Transactional
    public EntregaEfectivo confirmar(Long entregaId, Long usuarioId, BigDecimal montoConfirmado,
                                     String obsConfirmacion, String ip, String usuarioNombre) {
        EntregaEfectivo entrega = entregaRepository.findById(entregaId)
                .orElseThrow(() -> new ResourceNotFoundException("Entrega", entregaId));
        if (!"PENDIENTE".equals(entrega.getEstado())) {
            throw new BusinessException("La entrega ya fue procesada (" + entrega.getEstado() + ")",
                    "ENTREGA_YA_PROCESADA");
        }
        if (montoConfirmado == null || montoConfirmado.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("El monto recibido debe ser cero o mayor", "MONTO_INVALIDO");
        }

        BigDecimal diferencia = montoConfirmado.subtract(entrega.getMontoDeclarado());
        boolean cuadra = diferencia.compareTo(BigDecimal.ZERO) == 0;
        if (!cuadra && (obsConfirmacion == null || obsConfirmacion.isBlank())) {
            throw new BusinessException(
                "Si el monto no cuadra debe indicar una observación", "OBSERVACION_REQUERIDA");
        }

        entrega.setUsuarioConfirmaId(usuarioId);
        entrega.setMontoConfirmado(montoConfirmado);
        entrega.setDiferencia(diferencia);
        entrega.setEstado(cuadra ? "CONFIRMADA" : "OBSERVADA");
        entrega.setObsConfirmacion(obsConfirmacion);
        entrega.setFechaConfirmacion(LocalDateTime.now());

        EntregaEfectivo saved = entregaRepository.save(entrega);
        log.info("Entrega {} {}: declarado={} confirmado={} dif={}",
                saved.getNumero(), saved.getEstado(),
                saved.getMontoDeclarado(), montoConfirmado, diferencia);

        auditoriaService.registrar(Auditoria.builder()
                .usuarioId(usuarioId).usuarioNombre(usuarioNombre)
                .agenciaId(entrega.getAgenciaId()).accion("UPDATE").modulo("CAJA").entidad("ENTREGA_EFECTIVO")
                .registroId(saved.getId())
                .datosAntes("estado=PENDIENTE montoDeclarado=" + entrega.getMontoDeclarado().toPlainString())
                .datosDespues("estado=" + saved.getEstado()
                        + " montoConfirmado=" + montoConfirmado.toPlainString()
                        + " diferencia=" + diferencia.toPlainString())
                .ip(ip).build());

        return saved;
    }

    // ── Anular (solo PENDIENTE) ──────────────────────────────────────────────

    @Transactional
    public EntregaEfectivo anular(Long entregaId, Long usuarioId, String rol, String motivo,
                                  String ip, String usuarioNombre) {
        EntregaEfectivo entrega = entregaRepository.findById(entregaId)
                .orElseThrow(() -> new ResourceNotFoundException("Entrega", entregaId));
        if (!"PENDIENTE".equals(entrega.getEstado())) {
            throw new BusinessException("Solo se puede anular una entrega pendiente", "ENTREGA_YA_PROCESADA");
        }
        boolean esGerencia = "SUPER_ADMIN".equals(rol) || "GERENTE".equals(rol);
        if (!esGerencia && !entrega.getUsuarioEntregaId().equals(usuarioId)) {
            throw new BusinessException("Solo quien declaró la entrega puede anularla", "ACCESO_DENEGADO");
        }
        if (motivo == null || motivo.isBlank()) {
            throw new BusinessException("Debe indicar el motivo de anulación", "MOTIVO_REQUERIDO");
        }

        entrega.setEstado("ANULADA");
        entrega.setObsConfirmacion("ANULADA: " + motivo);
        EntregaEfectivo saved = entregaRepository.save(entrega);

        auditoriaService.registrar(Auditoria.builder()
                .usuarioId(usuarioId).usuarioNombre(usuarioNombre)
                .agenciaId(entrega.getAgenciaId()).accion("UPDATE").modulo("CAJA").entidad("ENTREGA_EFECTIVO")
                .registroId(saved.getId())
                .datosAntes("estado=PENDIENTE")
                .datosDespues("estado=ANULADA motivo=" + motivo)
                .ip(ip).build());

        return saved;
    }

    // ── Consultas ────────────────────────────────────────────────────────────

    public EntregaEfectivo getById(Long id) {
        return entregaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entrega", id));
    }

    public List<Map<String, Object>> listar(String rol, Long agenciaUsuario, Long filtroAgencia) {
        List<EntregaEfectivo> entregas;
        if ("SUPER_ADMIN".equals(rol) || "GERENTE".equals(rol)) {
            entregas = filtroAgencia != null
                    ? entregaRepository.findByAgenciaIdOrderByFechaEntregaDesc(filtroAgencia)
                    : entregaRepository.findAllByOrderByFechaEntregaDesc();
        } else {
            if (agenciaUsuario == null) return List.of();
            entregas = entregaRepository.findByAgenciaIdOrderByFechaEntregaDesc(agenciaUsuario);
        }
        return enrich(entregas);
    }

    /**
     * Resumen para la agencia del declarante: cuánto efectivo acumulado hay
     * pendiente de rendir (cierres de turno menos entregas ya declaradas).
     */
    public Map<String, Object> getResumenAgencia(Long agenciaId) {
        if (agenciaId == null) {
            throw new BusinessException("No se pudo determinar la agencia", "AGENCIA_REQUERIDA");
        }
        BigDecimal cierres   = nz(cajaRepository.sumMontoCierreByAgencia(agenciaId));
        BigDecimal entregado = nz(entregaRepository.sumDeclaradoVigente(agenciaId));
        BigDecimal pendiente = cierres.subtract(entregado);
        if (pendiente.compareTo(BigDecimal.ZERO) < 0) pendiente = BigDecimal.ZERO;

        LocalDateTime ultimaEntrega = entregaRepository
                .findFirstByAgenciaIdAndEstadoNotOrderByFechaEntregaDesc(agenciaId, "ANULADA")
                .map(EntregaEfectivo::getFechaEntrega).orElse(null);
        Long diasSinRendir = ultimaEntrega != null
                ? ChronoUnit.DAYS.between(ultimaEntrega, LocalDateTime.now()) : null;

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("agenciaId",       agenciaId);
        m.put("totalCierres",    cierres);
        m.put("totalEntregado",  entregado);
        m.put("pendienteRendir", pendiente);
        m.put("ultimaEntrega",   ultimaEntrega);
        m.put("diasSinRendir",   diasSinRendir);
        m.put("enAlerta",        pendiente.compareTo(MONTO_ALERTA) >= 0
                || (diasSinRendir != null && diasSinRendir >= DIAS_ALERTA));
        m.put("umbralMonto",     MONTO_ALERTA);
        m.put("umbralDias",      DIAS_ALERTA);
        return m;
    }

    /** Panel gerencial: efectivo pendiente de rendir y entregas en tránsito por agencia. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getPendientePorAgencia() {
        List<Object[]> agencias = (List<Object[]>) entityManager.createNativeQuery(
                "SELECT id, nombre, ciudad FROM agencias WHERE activo = true ORDER BY nombre")
                .getResultList();

        List<EntregaEfectivo> pendientes = entregaRepository.findByEstadoOrderByFechaEntregaDesc("PENDIENTE");

        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Object[] ag : agencias) {
            Long agId = ((Number) ag[0]).longValue();
            Map<String, Object> m = getResumenAgencia(agId);
            m.put("agenciaNombre", ag[1] + " — " + ag[2]);

            BigDecimal montoTransito = pendientes.stream()
                    .filter(e -> agId.equals(e.getAgenciaId()))
                    .map(EntregaEfectivo::getMontoDeclarado)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            long cantTransito = pendientes.stream()
                    .filter(e -> agId.equals(e.getAgenciaId())).count();
            m.put("entregasEnTransito", cantTransito);
            m.put("montoEnTransito",    montoTransito);
            resultado.add(m);
        }
        return resultado;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> enrich(List<EntregaEfectivo> entregas) {
        if (entregas.isEmpty()) return List.of();

        java.util.Set<Long> usuarioIds = new java.util.HashSet<>();
        java.util.Set<Long> agenciaIds = new java.util.HashSet<>();
        entregas.forEach(e -> {
            usuarioIds.add(e.getUsuarioEntregaId());
            if (e.getUsuarioConfirmaId() != null) usuarioIds.add(e.getUsuarioConfirmaId());
            agenciaIds.add(e.getAgenciaId());
        });

        Map<Long, String> usuarios = new HashMap<>();
        Map<Long, String> agencias = new HashMap<>();
        try {
            ((List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, nombres, apellidos FROM usuarios WHERE id IN :ids")
                    .setParameter("ids", usuarioIds).getResultList())
                    .forEach(r -> usuarios.put(((Number) r[0]).longValue(), r[1] + " " + r[2]));
            ((List<Object[]>) entityManager.createNativeQuery(
                    "SELECT id, nombre, ciudad FROM agencias WHERE id IN :ids")
                    .setParameter("ids", agenciaIds).getResultList())
                    .forEach(r -> agencias.put(((Number) r[0]).longValue(), r[1] + " — " + r[2]));
        } catch (Exception e) {
            log.warn("Batch nombres entregas: {}", e.getMessage());
        }

        return entregas.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",               e.getId());
            m.put("numero",           e.getNumero());
            m.put("agenciaId",        e.getAgenciaId());
            m.put("agenciaNombre",    agencias.getOrDefault(e.getAgenciaId(), "—"));
            m.put("entregaNombre",    usuarios.getOrDefault(e.getUsuarioEntregaId(), "—"));
            m.put("confirmaNombre",   e.getUsuarioConfirmaId() != null
                    ? usuarios.getOrDefault(e.getUsuarioConfirmaId(), "—") : null);
            m.put("modalidad",        e.getModalidad());
            m.put("nroOperacion",     e.getNroOperacion());
            m.put("montoDeclarado",   e.getMontoDeclarado());
            m.put("montoConfirmado",  e.getMontoConfirmado());
            m.put("diferencia",       e.getDiferencia());
            m.put("estado",           e.getEstado());
            m.put("observaciones",    e.getObservaciones());
            m.put("obsConfirmacion",  e.getObsConfirmacion());
            m.put("fechaEntrega",     e.getFechaEntrega());
            m.put("fechaConfirmacion", e.getFechaConfirmacion());
            return m;
        }).toList();
    }

    private String generarNumero(Long agenciaId) {
        // Secuencia global atómica en BD (V13) — sin colisiones aunque se borren filas
        int año = LocalDateTime.now().getYear();
        long seq = secuenciaService.siguiente("REN", 0L, año);
        return String.format("REN-%d-%05d", año, seq);
    }

    private BigDecimal nz(BigDecimal v) { return v != null ? v : BigDecimal.ZERO; }
}
