package com.expressvraem.modules.viajes.repository;

import com.expressvraem.modules.viajes.entity.Viaje;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ViajeRepository extends JpaRepository<Viaje, Long> {
    List<Viaje> findByAgenciaId(Long agenciaId);
    List<Viaje> findByAgenciaIdAndEstado(Long agenciaId, String estado);
    List<Viaje> findByAgenciaIdAndEstadoIn(Long agenciaId, List<String> estados);
    List<Viaje> findByEstadoIn(List<String> estados);
}
