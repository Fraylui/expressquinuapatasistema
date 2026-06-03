package com.expressvraem.modules.rutas.repository;

import com.expressvraem.modules.rutas.entity.Ruta;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RutaRepository extends JpaRepository<Ruta, Long> {
    List<Ruta> findByAgenciaId(Long agenciaId);
    List<Ruta> findByAgenciaIdAndActivoTrue(Long agenciaId);
    List<Ruta> findByActivoTrue();
    boolean existsByCodigoAndIdNot(String codigo, Long id);
}
