package com.expressvraem.modules.modulos.repository;

import com.expressvraem.modules.modulos.entity.Modulo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ModuloRepository extends JpaRepository<Modulo, Long> {
    List<Modulo> findByActivoTrue();
    Optional<Modulo> findByCodigo(String codigo);
}
