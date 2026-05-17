package com.expressvraem.modules.tarifas.repository;

import com.expressvraem.modules.tarifas.entity.Tarifa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TarifaRepository extends JpaRepository<Tarifa, Long> {

    List<Tarifa> findByAgenciaId(Long agenciaId);

    List<Tarifa> findByAgenciaIdAndVigenteTrue(Long agenciaId);

    List<Tarifa> findByVigenteTrue();

    @Query("SELECT t FROM Tarifa t WHERE t.vigente = true AND t.rutaId = :rutaId AND t.tipoVehiculo = :tipo")
    List<Tarifa> findVigenteByRutaAndTipo(@Param("rutaId") Long rutaId, @Param("tipo") String tipo);
}
