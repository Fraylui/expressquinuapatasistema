package com.expressvraem.modules.promociones.service;

import com.expressvraem.modules.promociones.dto.PromocionRequestDTO;
import com.expressvraem.modules.promociones.dto.PromocionResponseDTO;
import com.expressvraem.modules.promociones.entity.Promocion;
import com.expressvraem.modules.promociones.repository.PromocionRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PromocionService {

    private final PromocionRepository repository;

    // ── Consultas ─────────────────────────────────────────────────────────────

    public List<PromocionResponseDTO> getAll() {
        return repository.findAllByOrderByActivaDescNombreAsc()
                .stream().map(this::toDTO).toList();
    }

    /** Devuelve solo las promociones vigentes hoy para el módulo indicado. */
    public List<PromocionResponseDTO> getVigentes(String aplicaA) {
        return repository.findByActivaTrueOrderByNombreAsc().stream()
                .filter(p -> esVigente(p, aplicaA))
                .map(this::toDTO)
                .toList();
    }

    /** Valida un código de campaña y devuelve la promoción si está vigente. */
    public PromocionResponseDTO validarCodigo(String codigo, String aplicaA) {
        Promocion p = repository.findByCodigoIgnoreCase(codigo.trim())
                .orElseThrow(() -> new BusinessException(
                        "El código «" + codigo + "» no corresponde a ninguna promoción",
                        "PROMO_NO_ENCONTRADA"));
        if (!esVigente(p, aplicaA))
            throw new BusinessException(
                    "La promoción «" + p.getNombre() + "» no está vigente o no aplica aquí",
                    "PROMO_NO_VIGENTE");
        return toDTO(p);
    }

    public Optional<Promocion> findById(Long id) {
        return repository.findById(id);
    }

    // ── Cálculo de descuento ──────────────────────────────────────────────────

    public BigDecimal calcularDescuento(Promocion p, BigDecimal precioBase) {
        if ("MONTO_FIJO".equals(p.getTipoDescuento())) {
            return p.getValor().min(precioBase);
        }
        // PORCENTAJE e IDA_VUELTA usan porcentaje
        return precioBase
                .multiply(p.getValor())
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                .min(precioBase);
    }

    @Transactional
    public void incrementarUso(Long id) {
        Promocion p = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Promocion", id));
        p.setUsosActuales(p.getUsosActuales() + 1);
        repository.save(p);
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    @Transactional
    public PromocionResponseDTO crear(PromocionRequestDTO dto, String creadoPor) {
        if (dto.codigo() != null && !dto.codigo().isBlank()) {
            repository.findByCodigoIgnoreCase(dto.codigo()).ifPresent(e -> {
                throw new BusinessException(
                        "Ya existe una promoción con el código «" + dto.codigo() + "»",
                        "CODIGO_DUPLICADO");
            });
        }
        Promocion p = Promocion.builder()
                .nombre(dto.nombre().trim())
                .descripcion(dto.descripcion())
                .codigo(normalCodigo(dto.codigo()))
                .tipoDescuento(dto.tipoDescuento())
                .valor(dto.valor())
                .aplicaA(dto.aplicaA())
                .fechaInicio(dto.fechaInicio())
                .fechaFin(dto.fechaFin())
                .activa(dto.activa() != null ? dto.activa() : Boolean.TRUE)
                .limiteUsos(dto.limiteUsos())
                .creadoPor(creadoPor)
                .build();
        return toDTO(repository.save(p));
    }

    @Transactional
    public PromocionResponseDTO actualizar(Long id, PromocionRequestDTO dto) {
        Promocion p = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Promocion", id));

        String nuevoCodigo = normalCodigo(dto.codigo());
        if (nuevoCodigo != null && !nuevoCodigo.equals(p.getCodigo())) {
            repository.findByCodigoIgnoreCase(nuevoCodigo).ifPresent(e -> {
                throw new BusinessException(
                        "Ya existe una promoción con el código «" + nuevoCodigo + "»",
                        "CODIGO_DUPLICADO");
            });
        }

        p.setNombre(dto.nombre().trim());
        p.setDescripcion(dto.descripcion());
        p.setCodigo(nuevoCodigo);
        p.setTipoDescuento(dto.tipoDescuento());
        p.setValor(dto.valor());
        p.setAplicaA(dto.aplicaA());
        p.setFechaInicio(dto.fechaInicio());
        p.setFechaFin(dto.fechaFin());
        if (dto.activa() != null) p.setActiva(dto.activa());
        p.setLimiteUsos(dto.limiteUsos());
        return toDTO(repository.save(p));
    }

    @Transactional
    public void toggleActiva(Long id) {
        Promocion p = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Promocion", id));
        p.setActiva(!p.getActiva());
        repository.save(p);
    }

    @Transactional
    public void eliminar(Long id) {
        repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Promocion", id));
        repository.deleteById(id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private boolean esVigente(Promocion p, String aplicaA) {
        if (!Boolean.TRUE.equals(p.getActiva())) return false;
        LocalDate hoy = LocalDate.now();
        if (p.getFechaInicio() != null && hoy.isBefore(p.getFechaInicio())) return false;
        if (p.getFechaFin()    != null && hoy.isAfter(p.getFechaFin()))     return false;
        if (p.getLimiteUsos()  != null && p.getUsosActuales() >= p.getLimiteUsos()) return false;
        if (aplicaA != null && !"AMBOS".equals(p.getAplicaA()) && !aplicaA.equals(p.getAplicaA())) return false;
        return true;
    }

    private String normalCodigo(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return raw.trim().toUpperCase();
    }

    private PromocionResponseDTO toDTO(Promocion p) {
        return new PromocionResponseDTO(
                p.getId(), p.getNombre(), p.getDescripcion(), p.getCodigo(),
                p.getTipoDescuento(), p.getValor(), p.getAplicaA(),
                p.getFechaInicio(), p.getFechaFin(),
                Boolean.TRUE.equals(p.getActiva()),
                esVigente(p, null),
                p.getLimiteUsos(), p.getUsosActuales() != null ? p.getUsosActuales() : 0,
                p.getAgenciaId(), p.getCreadoEn());
    }
}
