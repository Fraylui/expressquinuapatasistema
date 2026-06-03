package com.expressvraem.modules.externas.repository;

import com.expressvraem.modules.externas.entity.EncomiendaExterna;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EncomiendaExternaRepository extends JpaRepository<EncomiendaExterna, Long> {

    List<EncomiendaExterna> findByAgenciaIdOrderByFechaRecepcionDesc(Long agenciaId);

    List<EncomiendaExterna> findByAgenciaIdAndEstadoOrderByFechaRecepcionDesc(Long agenciaId, String estado);

    @Query("SELECT COALESCE(MAX(e.secuencia), 0) FROM EncomiendaExterna e WHERE e.agenciaId = :agenciaId AND e.anio = :anio")
    int maxSecuencia(@Param("agenciaId") Long agenciaId, @Param("anio") int anio);
}
