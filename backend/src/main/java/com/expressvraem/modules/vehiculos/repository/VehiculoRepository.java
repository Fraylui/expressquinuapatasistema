package com.expressvraem.modules.vehiculos.repository;

import com.expressvraem.modules.vehiculos.entity.Vehiculo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VehiculoRepository extends JpaRepository<Vehiculo, Long> {
    List<Vehiculo> findByAgenciaId(Long agenciaId);
    List<Vehiculo> findByAgenciaIdAndEstadoNot(Long agenciaId, String estado);
}
