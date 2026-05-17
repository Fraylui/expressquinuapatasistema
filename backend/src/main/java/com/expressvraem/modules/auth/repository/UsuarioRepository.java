package com.expressvraem.modules.auth.repository;

import com.expressvraem.modules.auth.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmail(String email);
    Optional<Usuario> findByEmailAndActivo(String email, boolean activo);
    boolean existsByEmail(String email);
    boolean existsByDni(String dni);
}
