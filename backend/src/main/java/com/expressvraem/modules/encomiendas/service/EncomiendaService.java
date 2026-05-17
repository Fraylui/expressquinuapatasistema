package com.expressvraem.modules.encomiendas.service;

import com.expressvraem.modules.clientes.entity.Cliente;
import com.expressvraem.modules.clientes.service.ClienteService;
import com.expressvraem.modules.encomiendas.dto.RegistrarEncomiendaDTO;
import com.expressvraem.modules.encomiendas.entity.Encomienda;
import com.expressvraem.modules.encomiendas.entity.HistorialEncomienda;
import com.expressvraem.modules.encomiendas.repository.EncomiendaRepository;
import com.expressvraem.modules.encomiendas.repository.HistorialEncomiendaRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
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
    private final ClienteService clienteService;
    private final TrackingCodeGenerator trackingCodeGenerator;
    private final WebSocketEventPublisher wsPublisher;

    // 10-state machine
    private static final Map<String, Set<String>> TRANSICIONES = Map.of(
        "REGISTRADO",      Set.of("RECEPCIONADO", "DEVUELTO"),
        "RECEPCIONADO",    Set.of("ALMACENADO", "OBSERVADO"),
        "ALMACENADO",      Set.of("CARGADO", "DEVUELTO"),
        "CARGADO",         Set.of("EN_TRANSITO", "DEVUELTO"),
        "EN_TRANSITO",     Set.of("LLEGADO_AGENCIA", "OBSERVADO"),
        "LLEGADO_AGENCIA", Set.of("DISPONIBLE"),
        "DISPONIBLE",      Set.of("ENTREGADO"),
        "OBSERVADO",       Set.of("REGISTRADO", "DEVUELTO"),
        "ENTREGADO",       Set.of(),
        "DEVUELTO",        Set.of()
    );

    @Transactional
    public Encomienda registrar(RegistrarEncomiendaDTO dto, Long operadorId) {
        Long agenciaId = AgenciaContext.getAgenciaId();

        Cliente remitente = clienteService.findOrCreate(
                dto.remitenteTipoDoc(), dto.remitenteDoc(),
                dto.remitenteNombres(), dto.remitenteApellidos(),
                dto.remitenteRazonSocial(), dto.remitenteTelefono(), agenciaId);

        Cliente destinatario = clienteService.findOrCreate(
                dto.destinatarioTipoDoc(), dto.destinatarioDoc(),
                dto.destinatarioNombres(), dto.destinatarioApellidos(),
                dto.destinatarioRazonSocial(), dto.destinatarioTelefono(), agenciaId);

        String codigo = trackingCodeGenerator.generateCode();

        BigDecimal precio = dto.monto() != null ? dto.monto() : BigDecimal.ZERO;

        Encomienda enc = Encomienda.builder()
                .agenciaId(agenciaId)
                .agenciaOrigenId(agenciaId)
                .agenciaDestinoId(dto.agenciaDestinoId())
                .codigoTracking(codigo)
                .remitenteId(remitente.getId())
                .destinatarioId(destinatario.getId())
                .viajeId(dto.viajeId())
                .vendedorId(operadorId)
                .descripcion(dto.descripcion())
                .pesoKg(dto.pesoKg())
                .monto(precio)
                .precioEnvio(precio)
                .formaCobro(dto.formaCobro())
                .estado("REGISTRADO")
                .serie("E001")
                .observaciones(dto.observaciones())
                .build();

        Encomienda saved = encomiendaRepository.save(enc);
        guardarHistorial(saved.getId(), agenciaId, operadorId, null, "REGISTRADO", "Registro inicial");

        log.info("Encomienda registrada: {} monto={} cobro={}", codigo, precio, dto.formaCobro());
        return saved;
    }

    @Transactional
    public Encomienda cambiarEstado(Long id, String nuevoEstado, String observacion, Long usuarioId) {
        Encomienda enc = encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));

        String estadoActual = enc.getEstado();
        Set<String> validos = TRANSICIONES.getOrDefault(estadoActual, Set.of());

        if (!validos.contains(nuevoEstado)) {
            throw new BusinessException(
                    "Transición inválida: " + estadoActual + " → " + nuevoEstado,
                    "TRANSICION_INVALIDA");
        }

        guardarHistorial(id, enc.getAgenciaId(), usuarioId, estadoActual, nuevoEstado, observacion);
        enc.setEstado(nuevoEstado);
        Encomienda saved = encomiendaRepository.save(enc);

        wsPublisher.publicarCambioEstadoEncomienda(enc.getCodigoTracking(),
                new EstadoEncomiendaDTO(enc.getCodigoTracking(), estadoActual, nuevoEstado,
                        observacion, "sistema", LocalDateTime.now()));
        return saved;
    }

    @Transactional
    public Encomienda entregar(Long id, String recibidoPorDni, String recibidoPorNombre, Long usuarioId) {
        Encomienda enc = encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));

        if (!"DISPONIBLE".equals(enc.getEstado())) {
            throw new BusinessException("Solo se puede entregar si está en estado DISPONIBLE", "ESTADO_INVALIDO");
        }

        enc.setRecibidoPorDni(recibidoPorDni);
        enc.setRecibidoPorNombre(recibidoPorNombre);
        enc.setFechaEntregaReal(LocalDateTime.now());

        guardarHistorial(id, enc.getAgenciaId(), usuarioId, "DISPONIBLE", "ENTREGADO",
                "Recibido por: " + recibidoPorNombre + " (" + recibidoPorDni + ")");
        enc.setEstado("ENTREGADO");
        return encomiendaRepository.save(enc);
    }

    public Encomienda getById(Long id) {
        return encomiendaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", id));
    }

    public Encomienda getByTracking(String codigo) {
        return encomiendaRepository.findByCodigoTracking(codigo)
                .orElseThrow(() -> new ResourceNotFoundException("Encomienda", codigo));
    }

    public List<HistorialEncomienda> getHistorial(Long encomiendaId) {
        return historialRepository.findByEncomiendaIdOrderByCreatedAtAsc(encomiendaId);
    }

    public List<Encomienda> buscarConFiltros(Long agenciaId, String estado, Long destino,
                                              LocalDateTime desde, LocalDateTime hasta, String q) {
        return encomiendaRepository.buscarConFiltros(agenciaId, estado, destino, desde, hasta,
                q != null && !q.isBlank() ? q : null);
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
