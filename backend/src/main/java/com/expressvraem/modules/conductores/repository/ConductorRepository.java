package com.expressvraem.modules.conductores.repository;

import com.expressvraem.modules.conductores.entity.Conductor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConductorRepository extends JpaRepository<Conductor, Long> {
    List<Conductor> findByAgenciaId(Long agenciaId);
    List<Conductor> findByAgenciaIdAndActivo(Long agenciaId, boolean activo);
    Optional<Conductor> findByDni(String dni);
    boolean existsByDni(String dni);
    boolean existsByLicencia(String licencia);
    boolean existsByDniAndIdNot(String dni, Long id);
    boolean existsByLicenciaAndIdNot(String licencia, Long id);
}
