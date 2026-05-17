package com.expressvraem.modules.agencias.service;

import com.expressvraem.modules.agencias.dto.AgenciaRequestDTO;
import com.expressvraem.modules.agencias.dto.AgenciaResponseDTO;
import com.expressvraem.modules.agencias.entity.Agencia;
import com.expressvraem.modules.agencias.repository.AgenciaRepository;
import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AgenciaService {

    private final AgenciaRepository agenciaRepository;
    private final UsuarioRepository usuarioRepository;

    @PersistenceContext
    private EntityManager em;

    // ---- Mapper ----

    private AgenciaResponseDTO toDTO(Agencia a) {
        String encargadoNombre = null;
        if (a.getEncargadoId() != null) {
            encargadoNombre = usuarioRepository.findById(a.getEncargadoId())
                    .map(u -> u.getNombres() + " " + u.getApellidos())
                    .orElse(null);
        }
        return AgenciaResponseDTO.builder()
                .id(a.getId())
                .codigo(a.getCodigo())
                .nombre(a.getNombre())
                .ciudad(a.getCiudad())
                .direccion(a.getDireccion())
                .telefono(a.getTelefono())
                .email(a.getEmail())
                .ruc(a.getRuc())
                .encargadoId(a.getEncargadoId())
                .encargadoNombre(encargadoNombre)
                .estado(a.getEstado())
                .esSedePrincipal(a.isEsSedePrincipal())
                .fechaApertura(a.getFechaApertura())
                .fechaRegistro(a.getFechaRegistro())
                .build();
    }

    // ---- Queries ----

    public List<AgenciaResponseDTO> findAll() {
        return agenciaRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public AgenciaResponseDTO findById(Long id) {
        Agencia a = agenciaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Agencia", id));
        return toDTO(a);
    }

    public Agencia findEntityById(Long id) {
        return agenciaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Agencia", id));
    }

    // ---- CRUD ----

    @Transactional
    public AgenciaResponseDTO crear(AgenciaRequestDTO dto) {
        if (agenciaRepository.existsByCodigo(dto.getCodigo())) {
            throw new BusinessException("Ya existe una agencia con ese código", "CODIGO_DUPLICADO");
        }
        if (dto.getRuc() != null && !dto.getRuc().isBlank() && dto.getRuc().length() != 11) {
            throw new BusinessException("El RUC debe tener 11 dígitos", "RUC_INVALIDO");
        }
        Agencia a = Agencia.builder()
                .codigo(dto.getCodigo())
                .nombre(dto.getNombre())
                .ciudad(dto.getCiudad() != null ? dto.getCiudad() : "")
                .direccion(dto.getDireccion() != null ? dto.getDireccion() : "")
                .telefono(dto.getTelefono() != null ? dto.getTelefono() : "")
                .email(dto.getEmail())
                .ruc(dto.getRuc())
                .encargadoId(dto.getEncargadoId())
                .esSedePrincipal(dto.isEsSedePrincipal())
                .fechaApertura(dto.getFechaApertura())
                .estado("ACTIVA")
                .build();
        return toDTO(agenciaRepository.save(a));
    }

    @Transactional
    public AgenciaResponseDTO actualizar(Long id, AgenciaRequestDTO dto) {
        Agencia a = findEntityById(id);
        if (agenciaRepository.existsByCodigoAndIdNot(dto.getCodigo(), id)) {
            throw new BusinessException("Ya existe una agencia con ese código", "CODIGO_DUPLICADO");
        }
        if (dto.getRuc() != null && !dto.getRuc().isBlank() && dto.getRuc().length() != 11) {
            throw new BusinessException("El RUC debe tener 11 dígitos", "RUC_INVALIDO");
        }
        a.setCodigo(dto.getCodigo());
        a.setNombre(dto.getNombre());
        a.setCiudad(dto.getCiudad() != null ? dto.getCiudad() : "");
        a.setDireccion(dto.getDireccion() != null ? dto.getDireccion() : "");
        a.setTelefono(dto.getTelefono() != null ? dto.getTelefono() : "");
        a.setEmail(dto.getEmail());
        a.setRuc(dto.getRuc());
        a.setEncargadoId(dto.getEncargadoId());
        a.setEsSedePrincipal(dto.isEsSedePrincipal());
        a.setFechaApertura(dto.getFechaApertura());
        return toDTO(agenciaRepository.save(a));
    }

    @Transactional
    public void cambiarEstado(Long id, String estado) {
        Agencia a = findEntityById(id);
        if (!"ACTIVA".equals(estado) && !"INACTIVA".equals(estado)) {
            throw new BusinessException("Estado inválido: use ACTIVA o INACTIVA", "ESTADO_INVALIDO");
        }
        a.setEstado(estado);
        a.setActivo("ACTIVA".equals(estado));
        agenciaRepository.save(a);
    }

    // ---- Métricas ----

    @SuppressWarnings("unchecked")
    public Map<String, Object> getMetricas(Long agenciaId) {
        Number totalViajesMes = (Number) em.createNativeQuery(
                "SELECT COUNT(*) FROM viajes WHERE agencia_id = :id " +
                "AND DATE_TRUNC('month', fecha_hora_sal) = DATE_TRUNC('month', CURRENT_DATE)")
                .setParameter("id", agenciaId)
                .getSingleResult();

        Number totalPasajesMes = (Number) em.createNativeQuery(
                "SELECT COUNT(*) FROM pasajes WHERE agencia_id = :id " +
                "AND DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', CURRENT_DATE) " +
                "AND estado != 'ANULADO'")
                .setParameter("id", agenciaId)
                .getSingleResult();

        Number totalEncomiendaMes = (Number) em.createNativeQuery(
                "SELECT COUNT(*) FROM encomiendas WHERE agencia_id = :id " +
                "AND DATE_TRUNC('month', fecha_registro) = DATE_TRUNC('month', CURRENT_DATE)")
                .setParameter("id", agenciaId)
                .getSingleResult();

        Object sumIngresos = em.createNativeQuery(
                "SELECT COALESCE(SUM(monto), 0) FROM movimientos_caja WHERE agencia_id = :id " +
                "AND tipo = 'INGRESO' " +
                "AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)")
                .setParameter("id", agenciaId)
                .getSingleResult();

        Number usuariosActivos = (Number) em.createNativeQuery(
                "SELECT COUNT(*) FROM usuarios WHERE agencia_id = :id AND activo = true")
                .setParameter("id", agenciaId)
                .getSingleResult();

        BigDecimal totalIngresosMes = (sumIngresos instanceof BigDecimal)
                ? (BigDecimal) sumIngresos
                : new BigDecimal(sumIngresos.toString());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalViajesMes", totalViajesMes.longValue());
        result.put("totalPasajesMes", totalPasajesMes.longValue());
        result.put("totalEncomiendaMes", totalEncomiendaMes.longValue());
        result.put("totalIngresosMes", totalIngresosMes);
        result.put("usuariosActivos", usuariosActivos.longValue());
        return result;
    }
}
