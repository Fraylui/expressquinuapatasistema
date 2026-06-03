package com.expressvraem.modules.externas.service;

import com.expressvraem.modules.caja.repository.CajaRepository;
import com.expressvraem.modules.caja.service.CajaService;
import com.expressvraem.modules.externas.dto.EntregarEncomiendaExternaDTO;
import com.expressvraem.modules.externas.dto.RegistrarEncomiendaExternaDTO;
import com.expressvraem.modules.externas.entity.EncomiendaExterna;
import com.expressvraem.modules.externas.repository.EncomiendaExternaRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EncomiendaExternaService {

    private final EncomiendaExternaRepository repo;
    private final CajaRepository cajaRepository;
    private final CajaService cajaService;

    @Transactional
    public EncomiendaExterna registrar(RegistrarEncomiendaExternaDTO dto, Long operadorId, Long agenciaId) {
        if (agenciaId == null) {
            throw new BusinessException("No se pudo determinar la agencia del operador", "AGENCIA_REQUERIDA");
        }

        if ("PAGADO".equals(dto.estadoPago()) && (dto.formaPago() == null || dto.formaPago().isBlank())) {
            throw new BusinessException("Debe indicar la forma de pago cuando el cobro es inmediato.", "FORMA_PAGO_REQUERIDA");
        }

        int anio = LocalDateTime.now().getYear();
        int sig  = repo.maxSecuencia(agenciaId, anio) + 1;
        String correlativo = String.format("TCE-%d-%05d", anio, sig);

        EncomiendaExterna enc = EncomiendaExterna.builder()
                .agenciaId(agenciaId)
                .correlativo(correlativo)
                .secuencia(sig)
                .conductorNombre(dto.conductorNombre())
                .conductorDni(dto.conductorDni())
                .conductorTel(dto.conductorTel())
                .conductorPlaca(dto.conductorPlaca())
                .destinatarioNombre(dto.destinatarioNombre())
                .destinatarioDni(dto.destinatarioDni())
                .destinatarioTel(dto.destinatarioTel())
                .descripcion(dto.descripcion())
                .observaciones(dto.observaciones())
                .monto(dto.monto())
                .estadoPago(dto.estadoPago())
                .formaPago(dto.formaPago())
                .estado("PENDIENTE")
                .operadorId(operadorId)
                .build();

        EncomiendaExterna saved = repo.save(enc);

        if ("PAGADO".equals(dto.estadoPago()) && dto.monto().compareTo(BigDecimal.ZERO) > 0) {
            cajaRepository.findByUsuarioIdAndEstado(operadorId, "ABIERTA").ifPresentOrElse(
                caja -> {
                    try {
                        cajaService.registrarMovimiento(
                                caja.getId(), "INGRESO",
                                "Enc. externa " + correlativo + " — " + dto.formaPago(),
                                dto.monto(), operadorId, "ENC_EXTERNA", saved.getId());
                    } catch (Exception e) {
                        log.warn("Error registrando en caja para enc. externa {}: {}", correlativo, e.getMessage());
                        throw new BusinessException("Encomienda registrada pero fallo al registrar en caja: " + e.getMessage(), "CAJA_ERROR");
                    }
                },
                () -> log.warn("No hay caja abierta para operador {} al registrar enc. externa {}", operadorId, correlativo)
            );
        }

        log.info("Encomienda externa registrada: {} agencia={}", correlativo, agenciaId);
        return saved;
    }

    @Transactional
    public Map<String, Object> entregar(Long id, EntregarEncomiendaExternaDTO dto, Long operadorId, Long agenciaId) {
        EncomiendaExterna enc = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("EncomiendaExterna", id));

        if (!"PENDIENTE".equals(enc.getEstado())) {
            throw new BusinessException("Esta encomienda ya fue entregada.", "ESTADO_INVALIDO");
        }

        if (!enc.getAgenciaId().equals(agenciaId)) {
            throw new BusinessException("Esta encomienda no pertenece a su agencia.", "AGENCIA_INVALIDA");
        }

        boolean cobrado = false;

        if ("PENDIENTE".equals(enc.getEstadoPago())) {
            if (dto.formaPago() == null || dto.formaPago().isBlank()) {
                throw new BusinessException(
                        "Debe indicar la forma de pago para cobrar la encomienda al destinatario.",
                        "FORMA_PAGO_REQUERIDA");
            }
            var turno = cajaRepository.findByUsuarioIdAndEstado(operadorId, "ABIERTA");
            if (turno.isEmpty()) {
                throw new BusinessException(
                        "Debe tener un turno de caja abierto para cobrar. Abra su caja primero.",
                        "CAJA_REQUERIDA");
            }
            cajaService.registrarMovimiento(
                    turno.get().getId(), "INGRESO",
                    "Cobro entrega enc. externa " + enc.getCorrelativo() + " — " + dto.formaPago(),
                    enc.getMonto(), operadorId, "ENC_EXTERNA", id);
            enc.setEstadoPago("PAGADO");
            enc.setFormaPago(dto.formaPago());
            cobrado = true;
        }

        enc.setEstado("ENTREGADO");
        enc.setFechaEntrega(LocalDateTime.now());
        enc.setEntregadoA(dto.receptorNombre());
        enc.setEntregadoDni(dto.receptorDni());
        enc.setOperadorEntregaId(operadorId);

        EncomiendaExterna saved = repo.save(enc);
        log.info("Encomienda externa entregada: {} cobrado={}", enc.getCorrelativo(), cobrado);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("encomienda", saved);
        result.put("cobrado", cobrado);
        return result;
    }

    public List<EncomiendaExterna> getLista(Long agenciaId, String estado) {
        if (estado != null && !estado.isBlank()) {
            return repo.findByAgenciaIdAndEstadoOrderByFechaRecepcionDesc(agenciaId, estado);
        }
        return repo.findByAgenciaIdOrderByFechaRecepcionDesc(agenciaId);
    }

    public EncomiendaExterna getById(Long id) {
        return repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("EncomiendaExterna", id));
    }
}
