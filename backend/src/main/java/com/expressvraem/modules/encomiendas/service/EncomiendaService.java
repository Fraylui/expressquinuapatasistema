package com.expressvraem.modules.encomiendas.service;

import com.expressvraem.modules.encomiendas.dto.RegistrarEncomiendaDTO;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.entity.HistorialEncomienda;
import com.expressvraem.modules.encomiendas.repository.EncomiendaRepository;
import com.expressvraem.modules.encomiendas.repository.HistorialEncomiendaRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.expressvraem.shared.utils.PrecioCalculator;
import com.expressvraem.shared.utils.TrackingCodeGenerator;
import com.expressvraem.shared.websocket.WebSocketEventPublisher;
import com.expressvraem.shared.websocket.dto.EstadoEncomiendaDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class EncomiendaService {

    private final EncomiendaRepository encomiendaRepository;
    private final HistorialEncomiendaRepository historialRepository;
    private final TrackingCodeGenerator trackingCodeGenerator;
    private final PrecioCalculator precioCalculator;
    private final WebSocketEventPublisher wsPublisher;

    private static final Map<String, Set<String>> TRANSICIONES_VALIDAS = Map.of(
            "REGISTRADO",  Set.of("EN_TRANSITO", "DEVUELTO"),
            "EN_TRANSITO", Set.of("ENTREGADO", "DEVUELTO", "PERDIDO"),
            "ENTREGADO",   Set.of(),
            "DEVUELTO",    Set.of("REGISTRADO"),
            "PERDIDO",     Set.of()
    );

    @Transactional
    public Encomienda registrar(RegistrarEncomiendaDTO dto, Long operadorId) {
        Long agenciaId = AgenciaContext.getAgenciaId();
        String codigo = trackingCodeGenerator.generateCode();

        Integer distanciaKm = 280;
        BigDecimal precio = precioCalculator.calcularPrecioEncomienda(dto.pesoKg(), distanciaKm);

        Encomienda enc = Encomienda.builder()
                .agenciaId(agenciaId)
                .codigoTracking(codigo)
                .remitenteId(dto.remitenteId())
                .destinatarioId(dto.destinatarioId())
                .viajeId(dto.viajeId())
                .vendedorId(operadorId)
                .descripcion(dto.descripcion())
                .pesoKg(dto.pesoKg())
                .precioEnvio(precio)
                .estado("REGISTRADO")
                .serie("E001")
                .fechaEntregaEst(dto.fechaEntregaEst())
                .observaciones(dto.observaciones())
                .build();

        Encomienda saved = encomiendaRepository.save(enc);

        guardarHistorial(saved.getId(), agenciaId, operadorId, null, "REGISTRADO", "Registro inicial");

        log.info("Encomienda registrada: {} precio={}", codigo, precio);
        return saved;
    }

    @Transactional
    public Encomienda cambiarEstado(Long id, String nuevoEstado, String observacion, Long usuarioId) {
        Encomienda enc = encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));

        String estadoActual = enc.getEstado();
        Set<String> validos = TRANSICIONES_VALIDAS.getOrDefault(estadoActual, Set.of());

        if (!validos.contains(nuevoEstado)) {
            throw new BusinessException(
                    "Transición de estado inválida: " + estadoActual + " → " + nuevoEstado,
                    "TRANSICION_INVALIDA");
        }

        guardarHistorial(id, enc.getAgenciaId(), usuarioId, estadoActual, nuevoEstado, observacion);

        enc.setEstado(nuevoEstado);
        if ("ENTREGADO".equals(nuevoEstado)) {
            enc.setFechaEntregaReal(LocalDateTime.now());
        }
        Encomienda saved = encomiendaRepository.save(enc);

        wsPublisher.publicarCambioEstadoEncomienda(enc.getCodigoTracking(),
                new EstadoEncomiendaDTO(enc.getCodigoTracking(), estadoActual, nuevoEstado,
                        observacion, "sistema", LocalDateTime.now()));

        return saved;
    }

    public Encomienda getByTracking(String codigo) {
        return encomiendaRepository.findByCodigoTracking(codigo)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", codigo));
    }

    public List<HistorialEncomienda> getHistorial(Long encomiendaId) {
        return historialRepository.findByEncomiendaIdOrderByCreatedAtAsc(encomiendaId);
    }

    public List<Encomienda> getLista(Long agenciaId, String estado) {
        if (agenciaId == null) {
            // SUPER_ADMIN / GERENTE: sin filtro de agencia
            return estado != null
                ? encomiendaRepository.findByEstado(estado)
                : encomiendaRepository.findAll();
        }
        // OPERADOR / CONDUCTOR: solo su agencia
        return estado != null
            ? encomiendaRepository.findByAgenciaIdAndEstado(agenciaId, estado)
            : encomiendaRepository.findByAgenciaId(agenciaId);
    }

    private void guardarHistorial(Long encId, Long agenciaId, Long usuarioId,
                                  String anterior, String nuevo, String observacion) {
        historialRepository.save(HistorialEncomienda.builder()
                .encomiendaId(encId)
                .agenciaId(agenciaId)
                .usuarioId(usuarioId)
                .estadoAnterior(anterior)
                .estadoNuevo(nuevo)
                .observacion(observacion)
                .build());
    }
}
