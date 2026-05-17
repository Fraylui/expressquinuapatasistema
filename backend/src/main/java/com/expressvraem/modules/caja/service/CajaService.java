package com.expressvraem.modules.caja.service;

import com.expressvraem.modules.caja.entity.Caja;
import com.expressvraem.modules.caja.entity.MovimientoCaja;
import com.expressvraem.modules.caja.repository.CajaRepository;
import com.expressvraem.modules.caja.repository.MovimientoCajaRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.expressvraem.shared.middleware.AgenciaContext;
import com.expressvraem.shared.websocket.WebSocketEventPublisher;
import com.expressvraem.shared.websocket.dto.MovimientoCajaDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class CajaService {

    private final CajaRepository cajaRepository;
    private final MovimientoCajaRepository movimientoRepository;
    private final WebSocketEventPublisher wsPublisher;

    @Transactional
    public Caja abrirCaja(Long usuarioId, BigDecimal montoInicial) {
        Long agenciaId = AgenciaContext.getAgenciaId();

        if (cajaRepository.existsByUsuarioIdAndEstado(usuarioId, "ABIERTA")) {
            throw new BusinessException("Ya tiene una caja abierta", "CAJA_YA_ABIERTA");
        }

        Caja caja = Caja.builder()
                .agenciaId(agenciaId)
                .usuarioId(usuarioId)
                .fechaApertura(LocalDateTime.now())
                .montoApertura(montoInicial != null ? montoInicial : BigDecimal.ZERO)
                .totalIngresos(BigDecimal.ZERO)
                .totalEgresos(BigDecimal.ZERO)
                .estado("ABIERTA")
                .build();

        Caja saved = cajaRepository.save(caja);
        log.info("Caja abierta: id={} usuario={} montoInicial={}", saved.getId(), usuarioId, montoInicial);
        return saved;
    }

    @Transactional
    public MovimientoCaja registrarMovimiento(Long cajaId, String tipo, String concepto,
                                              BigDecimal monto, Long usuarioId,
                                              String referenciaTipo, Long referenciaId) {
        Caja caja = cajaRepository.findById(cajaId)
                .orElseThrow(() -> new ResourceNotFoundException("Caja", cajaId));

        if (!"ABIERTA".equals(caja.getEstado())) {
            throw new BusinessException("La caja no está abierta", "CAJA_CERRADA");
        }

        if ("INGRESO".equals(tipo)) {
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

        wsPublisher.publicarMovimientoCaja(cajaId,
                new MovimientoCajaDTO(cajaId, tipo, monto, saldo, LocalDateTime.now()));

        return saved;
    }

    @Transactional
    public Caja cerrarCaja(Long cajaId, BigDecimal montoFisico, String observaciones) {
        Caja caja = cajaRepository.findById(cajaId)
                .orElseThrow(() -> new ResourceNotFoundException("Caja", cajaId));

        if (!"ABIERTA".equals(caja.getEstado())) {
            throw new BusinessException("La caja ya está cerrada", "CAJA_YA_CERRADA");
        }

        BigDecimal saldoSistema = caja.getMontoApertura()
                .add(caja.getTotalIngresos())
                .subtract(caja.getTotalEgresos());
        BigDecimal diferencia = montoFisico.subtract(saldoSistema);

        caja.setMontoCierre(montoFisico);
        caja.setDiferencia(diferencia);
        caja.setEstado("CERRADA");
        caja.setFechaCierre(LocalDateTime.now());
        caja.setObservaciones(observaciones);

        Caja saved = cajaRepository.save(caja);
        log.info("Caja cerrada: id={} diferencia={}", cajaId, diferencia);
        return saved;
    }

    public Caja getTurnoActual(Long usuarioId) {
        return cajaRepository.findByUsuarioIdAndEstado(usuarioId, "ABIERTA")
                .orElseThrow(() -> new BusinessException("No tiene turno activo", "SIN_TURNO_ACTIVO"));
    }

    public List<MovimientoCaja> getMovimientos(Long cajaId) {
        return movimientoRepository.findByCajaIdOrderByCreatedAtAsc(cajaId);
    }

    public Map<String, Object> getResumenTurno(Long cajaId) {
        Caja caja = cajaRepository.findById(cajaId)
                .orElseThrow(() -> new ResourceNotFoundException("Caja", cajaId));
        BigDecimal saldo = caja.getMontoApertura().add(caja.getTotalIngresos()).subtract(caja.getTotalEgresos());
        return Map.of(
                "id", caja.getId(),
                "montoApertura", caja.getMontoApertura(),
                "totalIngresos", caja.getTotalIngresos(),
                "totalEgresos", caja.getTotalEgresos(),
                "saldoActual", saldo,
                "estado", caja.getEstado()
        );
    }
}
