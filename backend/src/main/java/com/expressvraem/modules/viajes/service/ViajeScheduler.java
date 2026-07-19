package com.expressvraem.modules.viajes.service;

import com.expressvraem.modules.caja.repository.CajaRepository;
import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.repository.EncomiendaRepository;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.modules.viajes.entity.Viaje;
import com.expressvraem.modules.viajes.repository.AsientoRepository;
import com.expressvraem.modules.viajes.repository.ViajeRepository;
import com.expressvraem.shared.websocket.WebSocketEventPublisher;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class ViajeScheduler {

    private final ViajeRepository         viajeRepository;
    private final PasajeRepository        pasajeRepository;
    private final AsientoRepository       asientoRepository;
    private final EncomiendaRepository    encomiendaRepository;
    private final CajaRepository          cajaRepository;
    private final CajaService             cajaService;
    private final WebSocketEventPublisher wsPublisher;
    private final EntityManager           entityManager;
    private final com.expressvraem.modules.auditoria.service.AuditoriaService auditoriaService;

    // ── Marcar atrasados ──────────────────────────────────────────────────────

    /** Cada 5 min: marca ATRASADO los viajes con 30+ min sin salir (pero <4h). */
    @Scheduled(fixedDelay = 5 * 60 * 1000)
    @Transactional
    public void marcarViajesAtrasados() {
        OffsetDateTime limite30m = OffsetDateTime.now().minusMinutes(30);
        OffsetDateTime limite4h  = OffsetDateTime.now().minusHours(4);

        List<Viaje> aMarcar = viajeRepository.findByEstadoIn(List.of("PROGRAMADO")).stream()
                .filter(v -> v.getFechaHoraSal() != null
                        && v.getFechaHoraSal().isBefore(limite30m)
                        && v.getFechaHoraSal().isAfter(limite4h))
                .toList();

        aMarcar.forEach(v -> {
            v.setEstado("ATRASADO");
            v.setUpdatedAt(OffsetDateTime.now());
            viajeRepository.save(v);
            log.info("Viaje #{} marcado ATRASADO. Hora programada: {}", v.getId(), v.getFechaHoraSal());
        });
    }

    // ── Cancelar vencidos ─────────────────────────────────────────────────────

    /**
     * Cada 15 min: cancela viajes PROGRAMADO/ATRASADO con 4+ horas sin salir.
     * Anula pasajes, libera asientos, revierte caja, regresa encomiendas a ALMACENADO
     * y notifica a la agencia en tiempo real vía WebSocket.
     */
    @Scheduled(fixedDelay = 15 * 60 * 1000)
    @Transactional
    public void cancelarViajesVencidos() {
        OffsetDateTime limite = OffsetDateTime.now().minusHours(4);

        List<Viaje> vencidos = viajeRepository.findByEstadoIn(List.of("PROGRAMADO", "ATRASADO")).stream()
                .filter(v -> v.getFechaHoraSal() != null && v.getFechaHoraSal().isBefore(limite))
                .toList();

        if (vencidos.isEmpty()) return;

        for (Viaje v : vencidos) {
            cancelarViaje(v);
        }

        log.info("Scheduler: {} viaje(s) cancelados automáticamente", vencidos.size());
    }

    private void cancelarViaje(Viaje viaje) {
        // 1. Cancelar el viaje
        viaje.setEstado("CANCELADO");
        viaje.setObservaciones("Cancelado automáticamente — no salió en las 4 horas posteriores a su hora programada");
        viaje.setUpdatedAt(OffsetDateTime.now());
        viajeRepository.save(viaje);
        log.warn("Viaje #{} auto-cancelado. Hora programada: {} Ruta ID: {}",
                viaje.getId(), viaje.getFechaHoraSal(), viaje.getRutaId());

        // 2. Procesar pasajes y encomiendas antes de notificar (para incluirlos en la notificación)
        List<Map<String, Object>> pasajerosAfectados = anularPasajesDelViaje(viaje);
        List<Map<String, Object>> encomiendasRetenidas = regresarEncomiendas(viaje);

        // 3. Notificar a la agencia en tiempo real
        notificarCancelacion(viaje, pasajerosAfectados, encomiendasRetenidas);
    }

    // ── Pasajes ───────────────────────────────────────────────────────────────

    private List<Map<String, Object>> anularPasajesDelViaje(Viaje viaje) {
        List<Pasaje> activos = pasajeRepository.findActivosByViajeId(viaje.getId());
        List<Map<String, Object>> resumen = new ArrayList<>();
        if (activos.isEmpty()) return resumen;

        String motivo = "Viaje #" + viaje.getId() + " cancelado automáticamente";

        for (Pasaje p : activos) {
            String estadoOriginal = p.getEstado();

            p.setEstado("ANULADO");
            p.setMotivoAnulacion(motivo);
            p.setFechaAnulacion(LocalDateTime.now());
            pasajeRepository.save(p);

            liberarAsiento(viaje.getId(), p.getAsientoNumero());
            registrarReversoEnCaja(p, estadoOriginal, motivo);

            // Construir resumen del pasajero para la notificación
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("pasajeId",     p.getId());
            info.put("boleta",       p.getCodigoBoleta());
            info.put("asiento",      p.getAsientoNumero());
            info.put("monto",        p.getPrecioFinal());
            info.put("clienteNombre", resolverNombreCliente(p.getClienteId()));
            resumen.add(info);
        }

        log.info("Viaje #{}: {} pasaje(s) anulados automáticamente", viaje.getId(), activos.size());
        return resumen;
    }

    private String resolverNombreCliente(Long clienteId) {
        if (clienteId == null) return "—";
        try {
            Object[] row = (Object[]) entityManager
                    .createNativeQuery("SELECT nombres, apellidos FROM clientes WHERE id = :id")
                    .setParameter("id", clienteId)
                    .getSingleResult();
            String n = row[0] != null ? row[0].toString() : "";
            String a = row[1] != null ? row[1].toString() : "";
            return (n + " " + a).trim();
        } catch (Exception e) {
            return "Cliente #" + clienteId;
        }
    }

    private void liberarAsiento(Long viajeId, Integer numeroAsiento) {
        if (numeroAsiento == null) return;
        asientoRepository.findByViajeIdAndNumero(viajeId, numeroAsiento)
                .ifPresent(a -> { a.setEstado("LIBRE"); asientoRepository.save(a); });
    }

    private void registrarReversoEnCaja(Pasaje pasaje, String estadoOriginal, String motivo) {
        if (pasaje.getPrecioFinal() == null || pasaje.getPrecioFinal().signum() == 0) return;
        if (!"VENDIDO".equals(estadoOriginal)) return;
        try {
            cajaRepository.findByUsuarioIdAndEstado(pasaje.getVendedorId(), "ABIERTA")
                    .ifPresentOrElse(caja -> {
                        cajaService.registrarMovimiento(
                                caja.getId(), "EGRESO",
                                "Reverso auto — " + motivo + " — boleta " + pasaje.getCodigoBoleta(),
                                pasaje.getPrecioFinal(), pasaje.getVendedorId(),
                                "REVERSO_PASAJE", pasaje.getId());
                        log.info("Reverso S/{} registrado en caja #{} por pasaje #{}",
                                pasaje.getPrecioFinal(), caja.getId(), pasaje.getId());
                    }, () -> registrarReversoOmitido(pasaje, motivo));
        } catch (Exception e) {
            log.warn("No se pudo registrar reverso en caja para pasaje #{}: {}", pasaje.getId(), e.getMessage());
            registrarReversoOmitido(pasaje, motivo + " (error: " + e.getMessage() + ")");
        }
    }

    /** El vendedor no tiene caja abierta: el egreso no se puede aplicar. Se deja
     *  rastro en log y auditoría para que gerencia lo cuadre a mano. */
    private void registrarReversoOmitido(Pasaje pasaje, String motivo) {
        log.warn("REVERSO OMITIDO: boleta {} por S/{} (vendedor #{} sin caja abierta) — {}",
                pasaje.getCodigoBoleta(), pasaje.getPrecioFinal(), pasaje.getVendedorId(), motivo);
        try {
            auditoriaService.registrar(com.expressvraem.modules.auditoria.entity.Auditoria.builder()
                    .usuarioId(pasaje.getVendedorId())
                    .usuarioNombre("SISTEMA (viaje cancelado)")
                    .agenciaId(pasaje.getAgenciaId())
                    .accion("UPDATE").modulo("CAJA").entidad("REVERSO_OMITIDO")
                    .registroId(pasaje.getId())
                    .datosDespues("Reverso NO aplicado: boleta=" + pasaje.getCodigoBoleta()
                            + " monto=" + pasaje.getPrecioFinal().toPlainString()
                            + " vendedorSinCajaAbierta=" + pasaje.getVendedorId()
                            + " motivo=" + motivo)
                    .build());
        } catch (Exception ex) {
            log.error("No se pudo auditar el reverso omitido del pasaje #{}: {}", pasaje.getId(), ex.getMessage());
        }
    }

    // ── Encomiendas ───────────────────────────────────────────────────────────

    private List<Map<String, Object>> regresarEncomiendas(Viaje viaje) {
        Set<String> estadosAfectados = Set.of("REGISTRADO", "RECEPCIONADO", "ALMACENADO", "CARGADO");
        List<Encomienda> asignadas = encomiendaRepository.findByViajeId(viaje.getId()).stream()
                .filter(e -> estadosAfectados.contains(e.getEstado()))
                .toList();

        List<Map<String, Object>> resumen = new ArrayList<>();
        if (asignadas.isEmpty()) return resumen;

        String nota = "⚠ Viaje #" + viaje.getId() + " cancelado automáticamente — pendiente de reasignar";

        asignadas.forEach(e -> {
            e.setViajeId(null);
            e.setEstado("ALMACENADO");
            // Agregar nota en observaciones para que el operador la priorice
            String obsActual = e.getObservaciones() != null ? e.getObservaciones() + " | " : "";
            e.setObservaciones(obsActual + nota);
            encomiendaRepository.save(e);

            Map<String, Object> info = new LinkedHashMap<>();
            info.put("encomiendaId",    e.getId());
            info.put("codigo",          e.getCodigoTracking());
            info.put("descripcion",     e.getDescripcion());
            info.put("agenciaDestinoId", e.getAgenciaDestinoId());
            resumen.add(info);

            log.info("Encomienda #{} ({}) regresada a ALMACENADO — viaje #{} cancelado",
                    e.getId(), e.getCodigoTracking(), viaje.getId());
        });

        log.info("Viaje #{}: {} encomienda(s) regresadas a ALMACENADO", viaje.getId(), asignadas.size());
        return resumen;
    }

    // ── Notificación WebSocket ────────────────────────────────────────────────

    private void notificarCancelacion(Viaje viaje,
                                      List<Map<String, Object>> pasajeros,
                                      List<Map<String, Object>> encomiendas) {
        String rutaInfo = resolverRuta(viaje.getRutaId());

        Map<String, Object> evento = new LinkedHashMap<>();
        evento.put("tipo",                 "VIAJE_CANCELADO");
        evento.put("viajeId",              viaje.getId());
        evento.put("ruta",                 rutaInfo);
        evento.put("horaProgramada",       viaje.getFechaHoraSal());
        evento.put("pasajerosAfectados",   pasajeros);
        evento.put("encomiendasRetenidas", encomiendas);
        evento.put("totalPasajeros",       pasajeros.size());
        evento.put("totalEncomiendas",     encomiendas.size());
        evento.put("timestamp",            OffsetDateTime.now());

        try {
            wsPublisher.publicarViajeCancelado(viaje.getAgenciaId(), evento);
            log.info("Notificación WebSocket enviada a agencia #{} por cancelación de viaje #{}",
                    viaje.getAgenciaId(), viaje.getId());
        } catch (Exception e) {
            log.warn("No se pudo enviar notificación WebSocket: {}", e.getMessage());
        }
    }

    private String resolverRuta(Long rutaId) {
        if (rutaId == null) return "—";
        try {
            Object[] row = (Object[]) entityManager
                    .createNativeQuery("SELECT origen, destino FROM rutas WHERE id = :id")
                    .setParameter("id", rutaId)
                    .getSingleResult();
            return row[0] + " → " + row[1];
        } catch (Exception e) {
            return "Ruta #" + rutaId;
        }
    }
}
