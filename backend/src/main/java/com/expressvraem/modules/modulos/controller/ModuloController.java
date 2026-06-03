package com.expressvraem.modules.modulos.controller;

import com.expressvraem.modules.auditoria.entity.Auditoria;
import com.expressvraem.modules.auditoria.service.AuditoriaService;
import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.modules.modulos.entity.Modulo;
import com.expressvraem.modules.modulos.entity.UsuarioModulo;
import com.expressvraem.modules.modulos.repository.ModuloRepository;
import com.expressvraem.modules.modulos.repository.UsuarioModuloRepository;
import com.expressvraem.shared.exceptions.ApiResponse;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
public class ModuloController {

    private final ModuloRepository moduloRepository;
    private final UsuarioModuloRepository usuarioModuloRepository;
    private final UsuarioRepository usuarioRepository;
    private final AuditoriaService auditoriaService;

    /** Lista todos los módulos del sistema */
    @GetMapping("/api/modulos")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Modulo>>> listarModulos() {
        return ResponseEntity.ok(ApiResponse.ok(moduloRepository.findByActivoTrue()));
    }

    /** Módulos de un usuario específico */
    @GetMapping("/api/usuarios/{id}/modulos")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> modulosDeUsuario(@PathVariable Long id) {
        List<Modulo> todos = moduloRepository.findByActivoTrue();
        List<UsuarioModulo> asignados = usuarioModuloRepository.findByUsuarioId(id);

        List<Map<String, Object>> resultado = todos.stream().map(m -> {
            boolean activo = asignados.stream()
                    .anyMatch(um -> um.getModulo().getId().equals(m.getId()) && Boolean.TRUE.equals(um.getActivo()));
            return Map.<String, Object>of(
                    "moduloId",    m.getId(),
                    "codigo",      m.getCodigo(),
                    "nombre",      m.getNombre(),
                    "descripcion", m.getDescripcion() != null ? m.getDescripcion() : "",
                    "icono",       m.getIcono() != null ? m.getIcono() : "",
                    "activo",      activo
            );
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(resultado));
    }

    /** Actualiza módulos activos de un usuario (reemplaza todos) */
    @PutMapping("/api/usuarios/{id}/modulos")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> actualizarModulos(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            Authentication auth) {

        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario", id));

        // SUPER_ADMIN no puede perder el módulo AUDITORIA
        if ("SUPER_ADMIN".equals(usuario.getRol())) {
            return ResponseEntity.ok(ApiResponse.ok("SUPER_ADMIN siempre tiene todos los módulos", null));
        }

        @SuppressWarnings("unchecked")
        List<Integer> moduloIds = (List<Integer>) body.get("moduloIds");

        // Obtiene el ID del admin que hace el cambio
        Long adminId = usuarioRepository.findByEmail(auth.getName()).map(Usuario::getId).orElse(null);

        // Borra asignaciones existentes
        usuarioModuloRepository.deleteByUsuarioId(id);

        // Inserta las nuevas
        if (moduloIds != null) {
            moduloIds.forEach(mid -> {
                moduloRepository.findById(mid.longValue()).ifPresent(modulo -> {
                    // AUDITORIA solo para SUPER_ADMIN
                    if ("AUDITORIA".equals(modulo.getCodigo())) return;

                    UsuarioModulo um = new UsuarioModulo();
                    um.setUsuarioId(id);
                    um.setModulo(modulo);
                    um.setActivo(true);
                    um.setFechaAsignacion(OffsetDateTime.now());
                    um.setAsignadoPor(adminId);
                    usuarioModuloRepository.save(um);
                });
            });
        }

        // Audit: registrar qué módulos se asignaron y a quién
        List<String> codigos = moduloIds == null ? List.of() :
                moduloIds.stream()
                        .map(Long::valueOf)
                        .map(mid -> moduloRepository.findById(mid)
                                .map(Modulo::getCodigo).orElse("?" + mid))
                        .collect(Collectors.toList());
        try {
            auditoriaService.registrar(Auditoria.builder()
                    .usuarioNombre(auth.getName())
                    .agenciaId(usuario.getAgenciaId())
                    .accion("UPDATE").modulo("MODULOS").entidad("PERMISOS")
                    .registroId(id)
                    .datosAntes("{\"usuario\":\"" + usuario.getEmail() + "\"}")
                    .datosDespues("{\"usuario\":\"" + usuario.getEmail()
                            + "\",\"modulosAsignados\":" + codigos + "}")
                    .build());
        } catch (Exception ignored) {}

        return ResponseEntity.ok(ApiResponse.ok("Módulos actualizados correctamente", null));
    }
}
