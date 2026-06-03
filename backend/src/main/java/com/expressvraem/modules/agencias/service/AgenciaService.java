package com.expressvraem.modules.agencias.service;

import com.expressvraem.modules.agencias.dto.AgenciaRequestDTO;
import com.expressvraem.modules.agencias.dto.AgenciaResponseDTO;
import com.expressvraem.modules.agencias.entity.Agencia;
import com.expressvraem.modules.agencias.repository.AgenciaRepository;
import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgenciaService {

    private final AgenciaRepository agenciaRepository;
    private final UsuarioRepository usuarioRepository;
    private final AuditoriaService auditoriaService;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "sistema";
    }

    private static String toJson(Agencia a) {
        if (a == null) return null;
        try {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",       a.getId());
            m.put("codigo",   a.getCodigo());
            m.put("nombre",   a.getNombre());
            m.put("ciudad",   a.getCiudad());
            m.put("tipo",     a.getTipo());
            m.put("estado",   a.getEstado());
            m.put("ruc",      a.getRuc());
            m.put("encargadoId", a.getEncargadoId());
            return MAPPER.writeValueAsString(m);
        } catch (Exception e) { return null; }
    }

    private void audit(String accion, Long registroId, Long agenciaId,
                       String antes, String despues) {
        try {
            auditoriaService.registrar(Auditoria.builder()
                    .usuarioNombre(currentUser())
                    .agenciaId(agenciaId)
                    .accion(accion).modulo("AGENCIAS").entidad("AGENCIA")
                    .registroId(registroId)
                    .datosAntes(antes).datosDespues(despues)
                    .build());
        } catch (Exception e) {
            log.warn("Audit AGENCIAS falló: {}", e.getMessage());
        }
    }

    @PersistenceContext
    private EntityManager em;

    private AgenciaResponseDTO toDTO(Agencia a, Map<Long, String> encargados, Map<Long, String> padres) {
        String tipo = (a.getTipo() != null && !a.getTipo().isBlank()) ? a.getTipo() : "AGENCIA";
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
                .encargadoNombre(a.getEncargadoId() != null ? encargados.get(a.getEncargadoId()) : null)
                .estado(a.getEstado())
                .esSedePrincipal(a.isEsSedePrincipal())
                .fechaApertura(a.getFechaApertura())
                .fechaRegistro(a.getFechaRegistro())
                .tipo(tipo)
                .agenciaPadreId(a.getAgenciaPadreId())
                .agenciaPadreNombre(a.getAgenciaPadreId() != null ? padres.get(a.getAgenciaPadreId()) : null)
                .build();
    }

    private AgenciaResponseDTO toDTO(Agencia a) {
        Map<Long, String> encargados = buildEncargadoMap(List.of(a));
        Map<Long, String> padres     = buildPadreMap(List.of(a));
        return toDTO(a, encargados, padres);
    }

    private Map<Long, String> buildEncargadoMap(List<Agencia> agencias) {
        List<Long> ids = agencias.stream()
                .map(Agencia::getEncargadoId).filter(Objects::nonNull).distinct()
                .collect(Collectors.toList());
        if (ids.isEmpty()) return Map.of();
        return usuarioRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(u -> u.getId(), u -> u.getNombres() + " " + u.getApellidos()));
    }

    private Map<Long, String> buildPadreMap(List<Agencia> agencias) {
        List<Long> ids = agencias.stream()
                .map(Agencia::getAgenciaPadreId).filter(Objects::nonNull).distinct()
                .collect(Collectors.toList());
        if (ids.isEmpty()) return Map.of();
        return agenciaRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Agencia::getId, Agencia::getNombre));
    }

    public List<AgenciaResponseDTO> findAllFlat() {
        List<Agencia> todas = agenciaRepository.findAll();
        Map<Long, String> encargados = buildEncargadoMap(todas);
        Map<Long, String> padres     = buildPadreMap(todas);
        return todas.stream().map(a -> toDTO(a, encargados, padres)).collect(Collectors.toList());
    }

    public List<AgenciaResponseDTO> findAll() {
        List<Agencia> todas = agenciaRepository.findAll();
        Map<Long, String> encargados = buildEncargadoMap(todas);
        Map<Long, String> padres     = buildPadreMap(todas);

        List<Agencia> principales = todas.stream()
                .filter(a -> !"SUCURSAL".equals(a.getTipo())).collect(Collectors.toList());
        List<Agencia> sucursales  = todas.stream()
                .filter(a -> "SUCURSAL".equals(a.getTipo())).collect(Collectors.toList());

        return principales.stream().map(p -> {
            AgenciaResponseDTO dto = toDTO(p, encargados, padres);
            dto.setSucursales(sucursales.stream()
                    .filter(s -> p.getId().equals(s.getAgenciaPadreId()))
                    .map(s -> toDTO(s, encargados, padres))
                    .collect(Collectors.toList()));
            return dto;
        }).collect(Collectors.toList());
    }

    public List<AgenciaResponseDTO> getArbol() {
        return findAll();
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

    public List<AgenciaResponseDTO> findPrincipalesActivas() {
        List<Agencia> lista = agenciaRepository.findByTipoAndEstado("AGENCIA", "ACTIVA");
        Map<Long, String> encargados = buildEncargadoMap(lista);
        return lista.stream().map(a -> toDTO(a, encargados, Map.of())).collect(Collectors.toList());
    }

    @Transactional
    public AgenciaResponseDTO crear(AgenciaRequestDTO dto) {
        if (agenciaRepository.existsByCodigo(dto.getCodigo())) {
            throw new BusinessException("Ya existe una agencia con ese código", "CODIGO_DUPLICADO");
        }
        if (dto.getRuc() != null && !dto.getRuc().isBlank() && dto.getRuc().length() != 11) {
            throw new BusinessException("El RUC debe tener 11 dígitos", "RUC_INVALIDO");
        }

        String tipo = (dto.getTipo() != null && !dto.getTipo().isBlank()) ? dto.getTipo() : "AGENCIA";

        if ("SUCURSAL".equals(tipo)) {
            if (dto.getAgenciaPadreId() == null) {
                throw new BusinessException("Una sucursal debe tener agencia padre", "AGENCIA_PADRE_REQUERIDA");
            }
            Agencia padre = agenciaRepository.findById(dto.getAgenciaPadreId())
                    .orElseThrow(() -> new ResourceNotFoundException("Agencia padre", dto.getAgenciaPadreId()));
            if (!"ACTIVA".equals(padre.getEstado())) {
                throw new BusinessException("La agencia padre no está activa", "AGENCIA_PADRE_INACTIVA");
            }
            if ("SUCURSAL".equals(padre.getTipo())) {
                throw new BusinessException("La agencia padre no puede ser una sucursal", "AGENCIA_PADRE_INVALIDA");
            }
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
                .esSedePrincipal("AGENCIA".equals(tipo) && dto.isEsSedePrincipal())
                .fechaApertura(dto.getFechaApertura())
                .estado("ACTIVA")
                .tipo(tipo)
                .agenciaPadreId("SUCURSAL".equals(tipo) ? dto.getAgenciaPadreId() : null)
                .build();
        Agencia saved = agenciaRepository.save(a);
        audit("INSERT", saved.getId(), saved.getId(), null, toJson(saved));
        return toDTO(saved);
    }

    @Transactional
    public AgenciaResponseDTO actualizar(Long id, AgenciaRequestDTO dto) {
        Agencia a = findEntityById(id);
        String antes = toJson(a);
        if (agenciaRepository.existsByCodigoAndIdNot(dto.getCodigo(), id)) {
            throw new BusinessException("Ya existe una agencia con ese código", "CODIGO_DUPLICADO");
        }
        if (dto.getRuc() != null && !dto.getRuc().isBlank() && dto.getRuc().length() != 11) {
            throw new BusinessException("El RUC debe tener 11 dígitos", "RUC_INVALIDO");
        }

        String tipo = (dto.getTipo() != null && !dto.getTipo().isBlank()) ? dto.getTipo() : a.getTipo();

        if ("SUCURSAL".equals(tipo) && dto.getAgenciaPadreId() != null) {
            Agencia padre = agenciaRepository.findById(dto.getAgenciaPadreId())
                    .orElseThrow(() -> new ResourceNotFoundException("Agencia padre", dto.getAgenciaPadreId()));
            if (!"ACTIVA".equals(padre.getEstado())) {
                throw new BusinessException("La agencia padre no está activa", "AGENCIA_PADRE_INACTIVA");
            }
        }

        a.setCodigo(dto.getCodigo());
        a.setNombre(dto.getNombre());
        a.setCiudad(dto.getCiudad() != null ? dto.getCiudad() : "");
        a.setDireccion(dto.getDireccion() != null ? dto.getDireccion() : "");
        a.setTelefono(dto.getTelefono() != null ? dto.getTelefono() : "");
        a.setEmail(dto.getEmail());
        a.setRuc(dto.getRuc());
        a.setEncargadoId(dto.getEncargadoId());
        a.setTipo(tipo);
        a.setAgenciaPadreId("SUCURSAL".equals(tipo) ? dto.getAgenciaPadreId() : null);
        a.setEsSedePrincipal("AGENCIA".equals(tipo) && dto.isEsSedePrincipal());
        a.setFechaApertura(dto.getFechaApertura());
        Agencia saved = agenciaRepository.save(a);
        audit("UPDATE", saved.getId(), saved.getId(), antes, toJson(saved));
        return toDTO(saved);
    }

    @Transactional
    public void cambiarEstado(Long id, String estado) {
        Agencia a = findEntityById(id);
        if (!"ACTIVA".equals(estado) && !"INACTIVA".equals(estado)) {
            throw new BusinessException("Estado inválido: use ACTIVA o INACTIVA", "ESTADO_INVALIDO");
        }
        String antes = toJson(a);
        a.setEstado(estado);
        a.setActivo("ACTIVA".equals(estado));
        agenciaRepository.save(a);
        audit("UPDATE", id, id, antes,
              "{\"estado\":\"" + estado + "\"}");
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getMetricas(Long agenciaId) {
        long totalViajesMes = 0, totalPasajesMes = 0, totalEncomiendaMes = 0, usuariosActivos = 0;
        BigDecimal totalIngresosMes = BigDecimal.ZERO;
        try {
            totalViajesMes = ((Number) em.createNativeQuery(
                    "SELECT COUNT(*) FROM viajes WHERE agencia_id = :id " +
                    "AND DATE_TRUNC('month', fecha_hora_sal) = DATE_TRUNC('month', CURRENT_DATE)")
                    .setParameter("id", agenciaId).getSingleResult()).longValue();
        } catch (Exception ignored) {}
        try {
            totalPasajesMes = ((Number) em.createNativeQuery(
                    "SELECT COUNT(*) FROM pasajes WHERE agencia_id = :id " +
                    "AND DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', CURRENT_DATE) " +
                    "AND estado != 'ANULADO'")
                    .setParameter("id", agenciaId).getSingleResult()).longValue();
        } catch (Exception ignored) {}
        try {
            totalEncomiendaMes = ((Number) em.createNativeQuery(
                    "SELECT COUNT(*) FROM encomiendas WHERE agencia_id = :id " +
                    "AND DATE_TRUNC('month', fecha_registro) = DATE_TRUNC('month', CURRENT_DATE)")
                    .setParameter("id", agenciaId).getSingleResult()).longValue();
        } catch (Exception ignored) {}
        try {
            Object sum = em.createNativeQuery(
                    "SELECT SUM(monto) FROM movimientos_caja WHERE agencia_id = :id " +
                    "AND tipo = 'INGRESO' " +
                    "AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)")
                    .setParameter("id", agenciaId).getSingleResult();
            if (sum != null) totalIngresosMes = new BigDecimal(sum.toString());
        } catch (Exception ignored) {}
        try {
            usuariosActivos = ((Number) em.createNativeQuery(
                    "SELECT COUNT(*) FROM usuarios WHERE agencia_id = :id AND activo = true")
                    .setParameter("id", agenciaId).getSingleResult()).longValue();
        } catch (Exception ignored) {}

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalViajesMes",     totalViajesMes);
        result.put("totalPasajesMes",    totalPasajesMes);
        result.put("totalEncomiendaMes", totalEncomiendaMes);
        result.put("totalIngresosMes",   totalIngresosMes);
        result.put("usuariosActivos",    usuariosActivos);
        return result;
    }
}
