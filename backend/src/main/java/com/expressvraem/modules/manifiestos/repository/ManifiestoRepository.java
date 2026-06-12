package com.expressvraem.modules.manifiestos.repository;

import com.expressvraem.modules.manifiestos.entity.Manifiesto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ManifiestoRepository extends JpaRepository<Manifiesto, Long> {

    Optional<Manifiesto> findByViajeId(Long viajeId);

    List<Manifiesto> findByAgenciaIdOrderByCreatedAtDesc(Long agenciaId);

    List<Manifiesto> findAllByOrderByCreatedAtDesc();

    long countByAgenciaId(Long agenciaId);
}
