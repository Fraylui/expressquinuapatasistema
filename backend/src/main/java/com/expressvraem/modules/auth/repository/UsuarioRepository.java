package com.expressvraem.modules.auth.repository;

import com.expressvraem.modules.auth.entity.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {
    Optional<Usuario> findByEmail(String email);
    Optional<Usuario> findByEmailAndActivo(String email, boolean activo);
    boolean existsByEmail(String email);
    boolean existsByDni(String dni);
    Optional<Usuario> findByDni(String dni);
    boolean existsByEmailAndIdNot(String email, Long id);
    boolean existsByDniAndIdNot(String dni, Long id);
    List<Usuario> findByAgenciaId(Long agenciaId);
    List<Usuario> findByAgenciaIdOrderByNombresAsc(Long agenciaId);
    List<Usuario> findByIntentosFallidosGreaterThan(int intentos);
}
