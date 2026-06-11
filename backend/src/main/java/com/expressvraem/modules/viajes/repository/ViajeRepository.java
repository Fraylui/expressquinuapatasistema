package com.expressvraem.modules.viajes.repository;

import com.expressvraem.modules.viajes.entity.Viaje;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface ViajeRepository extends JpaRepository<Viaje, Long> {
    List<Viaje> findByAgenciaId(Long agenciaId);
    List<Viaje> findByAgenciaIdAndEstado(Long agenciaId, String estado);
    List<Viaje> findByAgenciaIdAndEstadoIn(Long agenciaId, List<String> estados);
    List<Viaje> findByEstadoIn(List<String> estados);
    List<Viaje> findByEstadoInAndConductorId(List<String> estados, Long conductorId);

    @Query("SELECT v FROM Viaje v WHERE v.estado IN :estados " +
           "AND (v.vehiculoId = :vehiculoId OR v.conductorId = :conductorId) " +
           "AND v.id != :excludeId AND v.fechaHoraSal IS NOT NULL " +
           "AND v.fechaHoraSal BETWEEN :desde AND :hasta")
    List<Viaje> findConflictos(@Param("estados") List<String> estados,
                               @Param("vehiculoId") Long vehiculoId,
                               @Param("conductorId") Long conductorId,
                               @Param("excludeId") Long excludeId,
                               @Param("desde") OffsetDateTime desde,
                               @Param("hasta") OffsetDateTime hasta);
}
