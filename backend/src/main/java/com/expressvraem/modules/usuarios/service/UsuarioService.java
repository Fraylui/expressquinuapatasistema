package com.expressvraem.modules.usuarios.service;

import com.expressvraem.modules.auth.entity.Usuario;
import com.expressvraem.modules.auth.repository.UsuarioRepository;
import com.expressvraem.shared.exceptions.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;

    public List<Map<String, Object>> listar(Long agenciaId) {
        List<Usuario> usuarios = agenciaId != null
                ? usuarioRepository.findAll().stream()
                    .filter(u -> u.getAgenciaId().equals(agenciaId))
                    .collect(Collectors.toList())
                : usuarioRepository.findAll();

        return usuarios.stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id",          u.getId());
            map.put("nombres",     u.getNombres());
            map.put("apellidos",   u.getApellidos());
            map.put("nombre",      u.getNombres() + " " + u.getApellidos());
            map.put("email",       u.getEmail());
            map.put("dni",         u.getDni());
            map.put("rol",         u.getRol());
            map.put("activo",      u.isActivo());
            map.put("agenciaId",   u.getAgenciaId());
            map.put("ultimoAcceso", u.getUltimoAcceso() != null ? u.getUltimoAcceso().toString() : null);
            return map;
        }).collect(Collectors.toList());
    }

    @Transactional
    public void cambiarEstado(Long id, Boolean activo) {
        Usuario u = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario", id));
        u.setActivo(activo);
        usuarioRepository.save(u);
    }
}
