package com.expressvraem.modules.encomiendas.repository;

import com.expressvraem.modules.encomiendas.entity.Encomienda;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EncomiendaRepository extends JpaRepository<Encomienda, Long> {
    Optional<Encomienda> findByCodigoTracking(String codigoTracking);
    List<Encomienda> findByAgenciaId(Long agenciaId);
    List<Encomienda> findByAgenciaIdAndEstado(Long agenciaId, String estado);
    List<Encomienda> findByEstado(String estado);
    List<Encomienda> findByRemitenteId(Long remitenteId);
    List<Encomienda> findByDestinatarioId(Long destinatarioId);
    List<Encomienda> findByViajeId(Long viajeId);
}
