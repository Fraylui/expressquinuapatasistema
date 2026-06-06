package com.expressvraem.modules.usuarios.service;

import com.expressvraem.modules.agencias.entity.Agencia;
import com.expressvraem.modules.agencias.repository.AgenciaRepository;
import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.usuarios.dto.ActualizarUsuarioDTO;
import com.expressvraem.modules.usuarios.dto.CrearUsuarioDTO;
import com.expressvraem.shared.email.EmailService;
import com.expressvraem.shared.exceptions.BusinessException;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final AgenciaRepository agenciaRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final AuditoriaService auditoriaService;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "sistema";
    }

    private static String toJson(Usuario u) {
        if (u == null) return null;
        try {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",        u.getId());
            m.put("nombres",   u.getNombres());
            m.put("apellidos", u.getApellidos());
            m.put("email",     u.getEmail());
            m.put("dni",       u.getDni());
            m.put("rol",       u.getRol());
            m.put("activo",    u.isActivo());
            m.put("agenciaId", u.getAgenciaId());
            // password nunca se serializa
            return MAPPER.writeValueAsString(m);
        } catch (Exception e) { return null; }
    }

    private void audit(String accion, Long registroId, Long agenciaId,
                       String antes, String despues) {
        try {
            auditoriaService.registrar(Auditoria.builder()
                    .usuarioNombre(currentUser())
                    .agenciaId(agenciaId)
                    .accion(accion).modulo("USUARIOS").entidad("USUARIO")
                    .registroId(registroId)
                    .datosAntes(antes).datosDespues(despues)
                    .build());
        } catch (Exception e) {
            log.warn("Audit USUARIOS falló: {}", e.getMessage());
        }
    }

    private static final DateTimeFormatter DTF = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    public List<Map<String, Object>> listar(Long agenciaId) {
        Map<Long, String> agenciasMap = new HashMap<>();
        agenciaRepository.findAll().forEach(a -> agenciasMap.put(a.getId(), a.getNombre()));

        List<Usuario> usuarios = agenciaId != null
                ? usuarioRepository.findByAgenciaId(agenciaId)
                : usuarioRepository.findAll();

        return usuarios.stream().map(u -> toMap(u, agenciasMap)).collect(Collectors.toList());
    }

    public Map<String, Object> obtener(Long id) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario", id));
        Map<Long, String> agenciasMap = new HashMap<>();
        agenciaRepository.findById(u.getAgenciaId())
                .ifPresent(a -> agenciasMap.put(a.getId(), a.getNombre()));
        return toMap(u, agenciasMap);
    }

    private Map<String, Object> toMap(Usuario u, Map<Long, String> agenciasMap) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id",           u.getId());
        map.put("nombres",      u.getNombres());
        map.put("apellidos",    u.getApellidos());
        map.put("nombre",       u.getNombres() + " " + u.getApellidos());
        map.put("email",        u.getEmail());
        map.put("dni",          u.getDni());
        map.put("telefono",     u.getTelefono());
        map.put("rol",          u.getRol());
        map.put("activo",       u.isActivo());
        map.put("agenciaId",    u.getAgenciaId());
        map.put("agenciaNombre", agenciasMap.getOrDefault(u.getAgenciaId(), "Agencia #" + u.getAgenciaId()));
        map.put("ultimoAcceso", u.getUltimoAcceso() != null ? u.getUltimoAcceso().format(DTF) : null);
        map.put("createdAt",    u.getCreatedAt() != null ? u.getCreatedAt().format(DTF) : null);
        return map;
    }

    @Transactional
    public Map<String, Object> crear(CrearUsuarioDTO dto) {
        if (usuarioRepository.existsByEmail(dto.email())) {
            throw new BusinessException("Ya existe un usuario con ese email", "EMAIL_DUPLICADO");
        }
        if (usuarioRepository.existsByDni(dto.dni())) {
            throw new BusinessException("Ya existe un usuario con ese DNI", "DNI_DUPLICADO");
        }

        Agencia agencia = agenciaRepository.findById(dto.agenciaId())
                .orElseThrow(() -> new BusinessException("Agencia no encontrada", "AGENCIA_NOT_FOUND"));

        Usuario u = Usuario.builder()
                .agenciaId(dto.agenciaId())
                .nombres(dto.nombres())
                .apellidos(dto.apellidos())
                .email(dto.email())
                .dni(dto.dni())
                .telefono(dto.telefono())
                .passwordHash(passwordEncoder.encode(dto.password()))
                .rol(dto.rol())
                .activo(true)
                .build();

        Usuario saved = usuarioRepository.save(u);
        log.info("Usuario creado: {} ({})", saved.getEmail(), saved.getRol());

        emailService.enviarCredenciales(saved.getEmail(),
                saved.getNombres() + " " + saved.getApellidos(),
                saved.getEmail(), dto.password());

        audit("INSERT", saved.getId(), saved.getAgenciaId(), null, toJson(saved));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id",           saved.getId());
        result.put("nombres",      saved.getNombres());
        result.put("apellidos",    saved.getApellidos());
        result.put("email",        saved.getEmail());
        result.put("dni",          saved.getDni());
        result.put("rol",          saved.getRol());
        result.put("agenciaId",    saved.getAgenciaId());
        result.put("agenciaNombre", agencia.getNombre());
        result.put("activo",       saved.isActivo());
        return result;
    }

    @Transactional
    public Map<String, Object> actualizar(Long id, ActualizarUsuarioDTO dto) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario", id));

        if (usuarioRepository.existsByEmailAndIdNot(dto.email(), id))
            throw new BusinessException("Ya existe un usuario con ese email", "EMAIL_DUPLICADO");
        if (usuarioRepository.existsByDniAndIdNot(dto.dni(), id))
            throw new BusinessException("Ya existe un usuario con ese DNI", "DNI_DUPLICADO");

        String antes = toJson(u);
        u.setNombres(dto.nombres());
        u.setApellidos(dto.apellidos());
        u.setEmail(dto.email());
        u.setDni(dto.dni());
        if (dto.telefono() != null) u.setTelefono(dto.telefono());
        if (dto.rol() != null && !dto.rol().isBlank()) {
            if ("SUPER_ADMIN".equals(dto.rol()) && !"SUPER_ADMIN".equals(u.getRol())) {
                throw new BusinessException("No se puede asignar el rol SUPER_ADMIN.", "OPERACION_NO_PERMITIDA");
            }
            if ("SUPER_ADMIN".equals(u.getRol()) && !dto.rol().equals(u.getRol())) {
                throw new BusinessException("No se puede cambiar el rol de un SUPER_ADMIN.", "OPERACION_NO_PERMITIDA");
            }
            u.setRol(dto.rol());
        }
        if (dto.agenciaId() != null) u.setAgenciaId(dto.agenciaId());
        if (dto.nuevaPassword() != null && !dto.nuevaPassword().isBlank()) {
            u.setPasswordHash(passwordEncoder.encode(dto.nuevaPassword()));
        }

        Usuario saved = usuarioRepository.save(u);
        audit("UPDATE", saved.getId(), saved.getAgenciaId(), antes, toJson(saved));

        Map<String, Object> agenciasMap = new LinkedHashMap<>();
        agenciaRepository.findById(saved.getAgenciaId())
                .ifPresent(a -> agenciasMap.put("agenciaNombre", a.getNombre()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id",           saved.getId());
        result.put("nombres",      saved.getNombres());
        result.put("apellidos",    saved.getApellidos());
        result.put("email",        saved.getEmail());
        result.put("dni",          saved.getDni());
        result.put("telefono",     saved.getTelefono());
        result.put("rol",          saved.getRol());
        result.put("agenciaId",    saved.getAgenciaId());
        result.put("agenciaNombre", agenciasMap.getOrDefault("agenciaNombre", "Agencia #" + saved.getAgenciaId()));
        result.put("activo",       saved.isActivo());
        return result;
    }

    @Transactional
    public void cambiarEstado(Long id, Boolean activo) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario", id));

        // Nunca se puede desactivar a un SUPER_ADMIN
        if ("SUPER_ADMIN".equals(u.getRol()) && Boolean.FALSE.equals(activo)) {
            throw new BusinessException(
                "No se puede desactivar a un SUPER_ADMIN.",
                "OPERACION_NO_PERMITIDA");
        }

        // No puede desactivarse a sí mismo
        String emailActual = currentUser();
        if (u.getEmail().equals(emailActual) && Boolean.FALSE.equals(activo)) {
            throw new BusinessException(
                "No puedes desactivar tu propia cuenta.",
                "OPERACION_NO_PERMITIDA");
        }

        String antes = toJson(u);
        u.setActivo(activo);
        usuarioRepository.save(u);
        audit("UPDATE", id, u.getAgenciaId(),
              antes, "{\"activo\":" + activo + "}");
    }

    @Transactional
    public void cambiarRol(Long id, String nuevoRol) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario", id));

        // No se puede cambiar el rol del SUPER_ADMIN ni asignar ese rol desde aquí
        if ("SUPER_ADMIN".equals(u.getRol())) {
            throw new BusinessException(
                "No se puede cambiar el rol de un SUPER_ADMIN.",
                "OPERACION_NO_PERMITIDA");
        }
        if ("SUPER_ADMIN".equals(nuevoRol)) {
            throw new BusinessException(
                "No se puede asignar el rol SUPER_ADMIN a través de este endpoint.",
                "OPERACION_NO_PERMITIDA");
        }

        String antes = toJson(u);
        u.setRol(nuevoRol);
        usuarioRepository.save(u);
        audit("UPDATE", id, u.getAgenciaId(),
              antes, "{\"rol\":\"" + nuevoRol + "\"}");
    }
}
