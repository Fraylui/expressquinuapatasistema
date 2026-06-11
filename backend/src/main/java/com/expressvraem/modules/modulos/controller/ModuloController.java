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
import com.expressvraem.shared.exceptions.BusinessException;
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
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    public ResponseEntity<ApiResponse<List<Modulo>>> listarModulos() {
        return ResponseEntity.ok(ApiResponse.ok(moduloRepository.findByActivoTrue()));
    }

    /** Módulos de un usuario específico */
    @GetMapping("/api/usuarios/{id}/modulos")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> modulosDeUsuario(@PathVariable Long id) {
        List<Modulo> todos = moduloRepository.findByActivoTrue();
        List<UsuarioModulo> asignados = usuarioModuloRepository.findByUsuarioId(id);

        // Build O(1) lookup set instead of O(N×M) anyMatch per module
        java.util.Set<Long> activosIds = asignados.stream()
                .filter(um -> Boolean.TRUE.equals(um.getActivo()))
                .map(um -> um.getModulo().getId())
                .collect(Collectors.toSet());

        List<Map<String, Object>> resultado = todos.stream().map(m -> Map.<String, Object>of(
                "moduloId",    m.getId(),
                "codigo",      m.getCodigo(),
                "nombre",      m.getNombre(),
                "descripcion", m.getDescripcion() != null ? m.getDescripcion() : "",
                "icono",       m.getIcono() != null ? m.getIcono() : "",
                "activo",      activosIds.contains(m.getId())
        )).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok(resultado));
    }

    /** Actualiza módulos activos de un usuario (reemplaza todos) */
    @PutMapping("/api/usuarios/{id}/modulos")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','GERENTE')")
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

        // GERENTE solo puede modificar módulos de ADMIN_AGENCIA y OPERADOR (no de pares ni superiores)
        boolean esGerente = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_GERENTE".equals(a.getAuthority()));
        if (esGerente && ("GERENTE".equals(usuario.getRol()) || "SUPER_ADMIN".equals(usuario.getRol()))) {
            throw new BusinessException(
                    "Un GERENTE solo puede asignar módulos a usuarios ADMIN_AGENCIA y OPERADOR",
                    "PERMISO_DENEGADO");
        }

        @SuppressWarnings("unchecked")
        List<Integer> moduloIds = (List<Integer>) body.get("moduloIds");

        // Obtiene el ID del admin que hace el cambio
        Long adminId = usuarioRepository.findByEmail(auth.getName()).map(Usuario::getId).orElse(null);

        // Batch-load all requested modules in a single query — avoids N+1 in the assignment and audit loops
        Map<Long, Modulo> moduloMap = moduloIds == null ? Map.of() :
                moduloRepository.findAllById(moduloIds.stream().map(Long::valueOf).collect(Collectors.toList()))
                        .stream().collect(Collectors.toMap(Modulo::getId, m -> m));

        // Borra asignaciones existentes
        usuarioModuloRepository.deleteByUsuarioId(id);

        // Inserta las nuevas
        List<UsuarioModulo> nuevas = new java.util.ArrayList<>();
        if (moduloIds != null) {
            moduloIds.forEach(mid -> {
                Modulo modulo = moduloMap.get(mid.longValue());
                if (modulo == null || "AUDITORIA".equals(modulo.getCodigo())) return;
                UsuarioModulo um = new UsuarioModulo();
                um.setUsuarioId(id);
                um.setModulo(modulo);
                um.setActivo(true);
                um.setFechaAsignacion(OffsetDateTime.now());
                um.setAsignadoPor(adminId);
                nuevas.add(um);
            });
        }
        usuarioModuloRepository.saveAll(nuevas);

        // Audit: usar la misma caché en lugar de re-fetchear por ID
        List<String> codigos = moduloIds == null ? List.of() :
                moduloIds.stream()
                        .map(Long::valueOf)
                        .map(mid -> moduloMap.containsKey(mid)
                                ? moduloMap.get(mid).getCodigo()
                                : "?" + mid)
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
