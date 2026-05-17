package com.expressvraem.shared.security;

import com.expressvraem.modules.auth.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        var usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado: " + email));

        List<SimpleGrantedAuthority> authorities = new ArrayList<>();

        // Autoridad principal desde el campo rol directo
        authorities.add(new SimpleGrantedAuthority("ROLE_" + usuario.getRol()));

        // Permisos de módulos activos como authorities adicionales
        usuario.getModulosHabilitados().forEach(um -> {
            if (Boolean.TRUE.equals(um.getActivo())) {
                authorities.add(new SimpleGrantedAuthority("MODULO_" + um.getModulo().getCodigo()));
            }
        });

        return org.springframework.security.core.userdetails.User.builder()
                .username(usuario.getEmail())
                .password(usuario.getPasswordHash())
                .authorities(authorities)
                .accountExpired(false)
                .credentialsExpired(false)
                .disabled(!usuario.isActivo())
                .build();
    }
}
