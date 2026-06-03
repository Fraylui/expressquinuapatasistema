package com.expressvraem.modules.conductores.repository;

import com.expressvraem.modules.conductores.entity.Conductor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConductorRepository extends JpaRepository<Conductor, Long> {
    List<Conductor> findByAgenciaId(Long agenciaId);
    List<Conductor> findByAgenciaIdAndActivo(Long agenciaId, boolean activo);
    boolean existsByDni(String dni);
    boolean existsByLicencia(String licencia);
    boolean existsByDniAndIdNot(String dni, Long id);
    boolean existsByLicenciaAndIdNot(String licencia, Long id);
}
