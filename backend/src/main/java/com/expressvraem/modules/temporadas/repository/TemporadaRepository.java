package com.expressvraem.modules.temporadas.repository;

import com.expressvraem.modules.temporadas.entity.Temporada;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface TemporadaRepository extends JpaRepository<Temporada, Long> {

    List<Temporada> findByAgenciaId(Long agenciaId);

    List<Temporada> findByAgenciaIdAndActivoTrue(Long agenciaId);

    List<Temporada> findAllByOrderByFechaIniAsc();

    List<Temporada> findByActivoTrueOrderByFechaIniAsc();

    @Query("SELECT t FROM Temporada t WHERE t.agenciaId = :agenciaId AND t.activo = true " +
           "AND t.id != :excludeId " +
           "AND t.fechaIni <= :fechaFin AND t.fechaFin >= :fechaIni")
    List<Temporada> findSolapes(@Param("agenciaId") Long agenciaId,
                                @Param("excludeId") Long excludeId,
                                @Param("fechaIni") LocalDate fechaIni,
                                @Param("fechaFin") LocalDate fechaFin);
}
