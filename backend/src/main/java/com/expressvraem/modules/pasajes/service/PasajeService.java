package com.expressvraem.modules.pasajes.service;

import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.modules.pasajes.dto.VentaPasajeDTO;
import com.expressvraem.modules.pasajes.entity.Pasaje;
import com.expressvraem.modules.pasajes.repository.PasajeRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.expressvraem.shared.utils.PrecioCalculator;
import com.expressvraem.shared.websocket.WebSocketEventPublisher;
import com.expressvraem.shared.websocket.dto.AsientoUpdateDTO;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasajeService {

    private final PasajeRepository pasajeRepository;
    private final PrecioCalculator precioCalculator;
    private final WebSocketEventPublisher wsPublisher;
    private final EntityManager entityManager;
    private final CajaService cajaService;

    private static final AtomicLong correlativoSeq = new AtomicLong(0);

    @Transactional
    public Pasaje venderPasaje(VentaPasajeDTO dto, Long operadorId, String rolOperador) {
        Long agenciaId = AgenciaContext.getAgenciaId();

        // Bloquea el asiento con SELECT FOR UPDATE para evitar condición de carrera
        var asientoOpt = entityManager.createNativeQuery(
                "SELECT id, estado FROM asientos WHERE id = :id FOR UPDATE", Object[].class)
                .setParameter("id", dto.asientoId())
                .getResultList();

        if (asientoOpt.isEmpty()) {
            throw new ResourceNotFoundException("Asiento", dto.asientoId());
        }

        Object[] asientoRow = (Object[]) asientoOpt.get(0);
        String estadoAsiento = String.valueOf(asientoRow[1]);

        if (!"DISPONIBLE".equals(estadoAsiento)) {
            throw new BusinessException("El asiento no está disponible. Estado actual: " + estadoAsiento,
                    "ASIENTO_NO_DISPONIBLE");
        }

        // Bloquea el asiento
        entityManager.createNativeQuery("UPDATE asientos SET estado = 'VENDIDO' WHERE id = :id")
                .setParameter("id", dto.asientoId())
                .executeUpdate();

        // Obtiene tarifa base desde BD
        Object[] tarifaRow = (Object[]) entityManager.createNativeQuery(
                "SELECT precio FROM tarifas WHERE id = :id", Object[].class)
                .setParameter("id", dto.tarifaId())
                .getSingleResult();
        BigDecimal precioBase = new BigDecimal(String.valueOf(tarifaRow[0]));

        // Obtiene número de asiento
        Object[] asientoNumRow = (Object[]) entityManager.createNativeQuery(
                "SELECT numero FROM asientos WHERE id = :id", Object[].class)
                .setParameter("id", dto.asientoId())
                .getSingleResult();
        Integer numeroAsiento = (Integer) asientoNumRow[0];

        BigDecimal descuento = dto.montoDescuento() != null ? dto.montoDescuento() : BigDecimal.ZERO;
        BigDecimal precioFinal = precioCalculator.calcularPrecioPasaje(precioBase, BigDecimal.ZERO, descuento, rolOperador);

        long seq = correlativoSeq.incrementAndGet();
        String correlativo = String.format("%06d", seq);

        Pasaje pasaje = Pasaje.builder()
                .agenciaId(agenciaId)
                .viajeId(dto.viajeId())
                .asientoId(dto.asientoId())
                .clienteId(dto.clienteId())
                .tarifaId(dto.tarifaId())
                .vendedorId(operadorId)
                .descuentoId(dto.descuentoId())
                .precioBase(precioBase)
                .montoDescuento(descuento)
                .precioFinal(precioFinal)
                .formaPago(dto.formaPago() != null ? dto.formaPago() : "EFECTIVO")
                .estado("EMITIDO")
                .serie("T001")
                .correlativo(correlativo)
                .build();

        Pasaje saved = pasajeRepository.save(pasaje);

        // COSO — Actividades de control: toda venta registra automáticamente ingreso en caja
        try {
            cajaService.registrarMovimiento(
                    cajaService.getTurnoActual(operadorId).getId(),
                    "INGRESO",
                    "Pasaje " + correlativo + " — asiento " + numeroAsiento,
                    precioFinal,
                    operadorId,
                    "PASAJE",
                    saved.getId()
            );
        } catch (Exception ex) {
            // Si no hay caja abierta, el pasaje igual se registra (puede operar sin turno)
            log.warn("Sin turno activo para registrar ingreso de pasaje {}: {}", correlativo, ex.getMessage());
        }

        // Publica evento WebSocket
        wsPublisher.publicarActualizacionAsientos(dto.viajeId(),
                new AsientoUpdateDTO(dto.viajeId(), numeroAsiento, "VENDIDO", LocalDateTime.now()));

        log.info("Pasaje vendido: {} viaje={} asiento={} precio={}", correlativo, dto.viajeId(), dto.asientoId(), precioFinal);
        return saved;
    }

    @Transactional
    public void anularPasaje(Long id) {
        Pasaje pasaje = pasajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pasaje", id));

        if ("ANULADO".equals(pasaje.getEstado())) {
            throw new BusinessException("El pasaje ya está anulado", "PASAJE_YA_ANULADO");
        }

        pasaje.setEstado("ANULADO");
        pasajeRepository.save(pasaje);

        entityManager.createNativeQuery("UPDATE asientos SET estado = 'DISPONIBLE' WHERE id = :id")
                .setParameter("id", pasaje.getAsientoId())
                .executeUpdate();

        wsPublisher.publicarActualizacionAsientos(pasaje.getViajeId(),
                new AsientoUpdateDTO(pasaje.getViajeId(), null, "DISPONIBLE", LocalDateTime.now()));
    }

    public List<Pasaje> findByViaje(Long viajeId) {
        return pasajeRepository.findActivosByViajeId(viajeId);
    }

    public Pasaje findById(Long id) {
        return pasajeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Pasaje", id));
    }
}
